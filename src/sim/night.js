// Passage de la nuit : progression des besoins, maladies, vieillissement, ponte.
import { TRAITS, LAY_AGE, OLD_AGE, SYMPTOMS, MAX_ENERGY } from "./data.js";
import { chance, pick, shuffle } from "./rng.js";
import {
  ok, fail, clamp, recharge, capacity, hasBuilding, dayName, isMarketDay,
} from "./state.js";
import { logHen } from "./hens.js";
import { layEgg, advanceBrooding } from "./eggs.js";

function layProbability(h, ate, drank) {
  if (h.age < LAY_AGE || h.sex !== "hen") return 0;
  const base = h.age < 450 ? 0.85 : h.age < 500 ? 0.7 : 0.5;
  let p = base;
  if (!ate) p *= 0.5;
  if (!drank) p *= 0.5;
  if (h.sick) p *= 0.3;
  if (h.stress > 75) p *= 0.6;
  p *= 0.6 + 0.4 * (h.happiness / 100);
  return p;
}

export function sleepDay(s, now = Date.now()) {
  recharge(s, now);
  if (s.energy < 1) return fail("Plus d'énergie : une nouvelle nuit sera possible bientôt.");
  s.energy -= 1;
  if (s.energy === MAX_ENERGY - 1) s.energyAt = now;

  const recap = {
    day: s.day, weekday: dayName(s), lines: [], bonds: [], sick: [], cured: [], warnings: [],
    wasMarket: isMarketDay(s),
  };
  const hens = s.hens;
  const n = hens.length;
  const cap = capacity(s);
  const crowd = cap ? Math.max(0, (n - cap) / cap) : 0;

  // 1. Repas et boisson : le stock est partagé, ordre aléatoire quand il en manque.
  const fed = new Set(), watered = new Set(), foraged = new Set();
  for (const h of shuffle(s, hens)) {
    if (s.feederStock > 0) { s.feederStock -= 1; fed.add(h.id); } else foraged.add(h.id);
    if (s.waterStock > 0) { s.waterStock -= 1; watered.add(h.id); }
  }
  if (n && !fed.size) recap.warnings.push("La mangeoire est vide : les poules ont dû picorer dans l'herbe.");
  else if (n && foraged.size) recap.warnings.push(`La mangeoire s'est vidée : ${foraged.size} poule(s) sont restées sur leur faim.`);
  if (n && !watered.size) recap.warnings.push("L'abreuvoir est vide : pense à le remplir.");
  else if (n && watered.size < n) recap.warnings.push(`Il manquait de l'eau pour ${n - watered.size} poule(s).`);

  // 2. Propreté du poulailler
  s.cleanliness = clamp(s.cleanliness - (6 + n * 1.2 + crowd * 6));
  if (hasBuilding(s, "coop") && s.cleanliness < 40) recap.warnings.push("Le poulailler est sale : les poules risquent de pondre ailleurs que dans les nids.");

  // 3. Besoins, santé, personnalité
  const mates = Math.min(5, Math.max(0, n - 1));
  for (const h of hens) {
    const t = TRAITS[h.trait];
    const ate = fed.has(h.id), drank = watered.has(h.id);
    h.satiety = clamp(ate ? h.satiety + 50 : foraged.has(h.id) ? h.satiety - 20 * t.appetite : h.satiety - 35 * t.appetite);
    h.hydration = clamp(drank ? h.hydration + 50 : h.hydration - 35);
    h.cleanliness = clamp(h.cleanliness + (s.cleanliness - h.cleanliness) * 0.5);
    const socialTarget = clamp((35 + mates * 13) * t.social + (t.social < 0.5 ? 25 : 0));
    h.social = clamp(h.social + (socialTarget - h.social) * 0.4);

    const needy = h.satiety < 25 || h.hydration < 25;
    const stressTarget = clamp(
      15 + crowd * 40 + (100 - s.cleanliness) * 0.25 + (needy ? 25 : 0) + (h.sick ? 15 : 0)
      + (h.social < 30 ? 10 : 0) - h.trust * 0.1,
    ) * t.stress;
    h.stress = clamp(h.stress + (stressTarget - h.stress) * 0.45);

    // Maladie : jamais mortelle, le jeu reste doux.
    if (h.sick) {
      h.sickDays += 1;
      h.health = clamp(h.health - 5, 5);
      if (h.sickDays >= 3 && !needy && chance(s, 0.2)) {
        h.sick = false; h.sickDays = 0; h.symptom = "";
        h.health = clamp(h.health + 10);
        logHen(s, h, "S'est rétablie toute seule.");
        recap.cured.push(h.name);
      }
    } else {
      h.health = clamp(needy ? h.health - 8 : h.health + 4, 5);
      const risk = 0.012 + (100 - s.cleanliness) / 100 * 0.05 + crowd * 0.08
        + (h.stress > 70 ? 0.03 : 0) + (h.health < 50 ? 0.04 : 0) + (needy ? 0.04 : 0);
      if (chance(s, risk)) {
        h.sick = true; h.sickDays = 0; h.symptom = pick(s, SYMPTOMS);
        h.health = clamp(h.health - 10, 5);
        logHen(s, h, `Est tombée malade (${h.symptom}).`);
        recap.sick.push({ name: h.name, symptom: h.symptom });
      }
    }

    const mood = (h.satiety + h.hydration + h.health + h.cleanliness + h.social + (100 - h.stress)) / 6
      + h.trust * 0.05 + h.affection * 0.05;
    h.happiness = clamp(h.happiness + (mood - h.happiness) * 0.45);
  }

  // 4. Résumé des liens du jour, puis remise à zéro des plafonds quotidiens
  for (const h of hens) {
    if (h.today.affection > 0.01 || h.today.trust > 0.01) {
      recap.bonds.push({ name: h.name, affection: Math.round(h.today.affection * 10) / 10, trust: Math.round(h.today.trust * 10) / 10 });
    }
    if (h.today.cared) recap.lines.push(`${h.name} a reçu des soins.`);
  }

  // 5. Vieillissement
  for (const h of hens) h.age += 1;
  for (const h of hens) {
    if (h.age === 18) { logHen(s, h, "A fini de grandir : c'est une jeune poule !"); recap.lines.push(`${h.name} a fini de grandir.`); }
    if (h.age === LAY_AGE) { recap.lines.push(`${h.name} approche de l'âge de la ponte.`); }
  }

  // 6. Ponte (secrète) puis couvaison
  s.day += 1;
  for (const h of shuffle(s, hens)) {
    if (chance(s, layProbability(h, fed.has(h.id), watered.has(h.id)))) layEgg(s, h);
  }
  advanceBrooding(s, recap.lines);

  // 7. Mortalité naturelle (désactivée par défaut)
  if (s.settings.mortality) {
    for (const h of s.hens.slice()) {
      if (h.age > OLD_AGE && chance(s, Math.min(0.5, (h.age - OLD_AGE) / 1500))) {
        s.hens = s.hens.filter((x) => x.id !== h.id);
        recap.lines.push(`${h.name} s'est éteinte paisiblement de vieillesse.`);
      }
    }
  }

  for (const h of s.hens) h.today = { affection: 0, trust: 0, pets: 0, cared: false };

  // 8. Nouveau jour : marché ?
  if (isMarketDay(s)) recap.lines.push("C'est dimanche : le marché du village est ouvert !");
  s.market.session = null;
  s.stats.nights += 1;
  recap.newDay = s.day;
  recap.newWeekday = dayName(s);
  s.recap = recap;
  return ok("Nouvelle journée.", { recap });
}
