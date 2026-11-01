// Interactions quotidiennes avec les poules (sans coût d'énergie).
import { TRAITS, PET_CAP, CARE_PRICE } from "./data.js";
import { ok, fail, clamp } from "./state.js";
import { findHen } from "./farm.js";

export function logHen(s, h, text) {
  h.history.unshift({ day: s.day, text });
  if (h.history.length > 40) h.history.length = 40;
}

// Caresser : répétable, mais les gains d'affection / de confiance sont plafonnés par jour.
export function petHen(s, id) {
  const h = findHen(s, id);
  if (!h) return fail("Poule introuvable.");
  const t = TRAITS[h.trait];
  const dAff = Math.min(1 * t.aff, PET_CAP.affection - h.today.affection);
  const dTrust = Math.min(0.75 * t.trust, PET_CAP.trust - h.today.trust);
  h.today.pets += 1;
  if (dAff <= 0.001 && dTrust <= 0.001) {
    h.happiness = clamp(h.happiness + 0.5);
    return ok(`${h.name} savoure la caresse, mais elle a eu sa dose d'affection pour aujourd'hui.`, { capped: true });
  }
  h.today.affection += Math.max(0, dAff);
  h.today.trust += Math.max(0, dTrust);
  h.affection = clamp(h.affection + Math.max(0, dAff));
  h.trust = clamp(h.trust + Math.max(0, dTrust));
  h.happiness = clamp(h.happiness + 3);
  h.stress = clamp(h.stress - 2);
  return ok(`${h.name} se laisse caresser.`, { capped: false });
}

export function careHen(s, id) {
  const h = findHen(s, id);
  if (!h) return fail("Poule introuvable.");
  if (!h.sick) return fail(`${h.name} n'a pas besoin de soins.`);
  if (s.coins < CARE_PRICE) return fail("Pas assez de pièces pour les soins.");
  s.coins -= CARE_PRICE;
  h.sick = false; h.sickDays = 0; h.symptom = "";
  h.health = clamp(Math.max(h.health, 50) + 15);
  h.trust = clamp(h.trust + 2);
  h.today.cared = true;
  logHen(s, h, "A été soignée et se sent mieux.");
  return ok(`${h.name} est soignée.`);
}

// Décision volontaire, réservée aux situations graves.
export function canEuthanize(h) { return h.sick && h.health <= 25 && h.sickDays >= 3; }
export function euthanize(s, id) {
  const h = findHen(s, id);
  if (!h) return fail("Poule introuvable.");
  if (!canEuthanize(h)) return fail("Ce n'est pas nécessaire : elle peut encore être soignée.");
  s.hens = s.hens.filter((x) => x.id !== id);
  return ok(`${h.name} s'est endormie paisiblement. Merci pour tous ces beaux jours.`);
}

export const stageOf = (h) => (h.age < 18 ? "chick" : h.age < 60 ? "young" : h.age < 500 ? "adult" : "senior");
export const STAGE_LABEL = { chick: "Poussin", young: "Jeune poule", adult: "Poule adulte", senior: "Ancienne" };
