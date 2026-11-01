import test from "node:test";
import assert from "node:assert/strict";
import * as G from "../src/sim/index.js";

const {
  createGame, buyBuilding, buyHen, buyFeed, fillFeeder, fillWater, cleanCoop, sleepDay, petHen, careHen,
  euthanize, collectEgg, toggleBrood, moveBuilding, upgradeBuilding, openMarket, marketDecision, closeMarket,
  currentVisitor, referencePrice, storedEggs, recharge, msUntilEnergy, serialize, deserialize, layEgg, hiddenChance,
  advanceBrooding, isMarketDay, dayName, capacity, MAX_ENERGY, ENERGY_MS, canEuthanize,
} = G;

// Ferme prête : enclos au centre, tout le reste à l'intérieur.
function farm(seed = 42) {
  const s = createGame(0, seed);
  assert.ok(buyBuilding(s, "pen", 0, 0).ok);
  assert.ok(buyBuilding(s, "coop", -1, -2).ok);
  assert.ok(buyBuilding(s, "feeder", 2, 2).ok);
  assert.ok(buyBuilding(s, "water", -2, 2).ok);
  s.coins = 1000; // de quoi tester sans contrainte budgétaire
  return s;
}
const night = (s, t = 0) => { s.energy = MAX_ENERGY; return sleepDay(s, t); };

test("démarrage : terrain vide, 280 pièces, 15 énergies", () => {
  const s = createGame(0, 1);
  assert.equal(s.buildings.length, 0);
  assert.equal(s.hens.length, 0);
  assert.equal(s.coins, 280);
  assert.equal(s.energy, 15);
  assert.equal(dayName(s), "Lundi");
});

test("on ne peut pas acheter de poule sans installations complètes et correctement placées", () => {
  const s = createGame(0, 1);
  assert.equal(buyHen(s, "young").ok, false);
  const f = farm();
  assert.ok(buyHen(f, "young").ok);
  // mangeoire placée hors de l'enclos
  const g = createGame(0, 1);
  buyBuilding(g, "pen", 0, 0); buyBuilding(g, "coop", 0, 0); buyBuilding(g, "water", -3, 3);
  buyBuilding(g, "feeder", 10, 10);
  assert.match(buyHen(g, "young").msg, /intérieur de l'enclos/);
});

test("placement : chevauchement, clôture et limites du terrain refusés", () => {
  const s = farm();
  assert.equal(buyBuilding(createGame(0, 1), "pen", 15, 0).ok, false); // dépasse
  assert.match(moveBuilding(s, s.buildings[2].id, -1, -2).msg, /Trop près/);
  assert.match(moveBuilding(s, s.buildings[2].id, 5, 0).msg, /clôture/);
  assert.ok(moveBuilding(s, s.buildings[2].id, 3, 0).ok);
});

test("l'achat est refusé sans argent et ne débite rien", () => {
  const s = createGame(0, 1);
  s.coins = 10;
  const r = buyBuilding(s, "coop", 0, 0);
  assert.equal(r.ok, false);
  assert.equal(s.coins, 10);
  assert.equal(s.buildings.length, 0);
});

test("extension du poulailler et de l'enclos : coût, capacité", () => {
  const s = farm();
  assert.equal(capacity(s), 6);
  assert.ok(upgradeBuilding(s, "coop").ok);
  assert.equal(capacity(s), 8); // limité par l'enclos de niveau 1
  assert.ok(upgradeBuilding(s, "pen").ok);
  assert.equal(capacity(s), 10);
  assert.ok(upgradeBuilding(s, "pen").ok);
  assert.equal(upgradeBuilding(s, "pen").ok, false);
});

test("énergie : -1 par nuit, recharge 1/10 min y compris hors ligne, plafond 15", () => {
  const s = farm();
  s.energy = 15; s.energyAt = 0;
  assert.ok(sleepDay(s, 1000).ok);
  assert.equal(s.energy, 14);
  recharge(s, 1000 + ENERGY_MS * 3 + 5);
  assert.equal(s.energy, 15);
  s.energy = 10; s.energyAt = 0;
  recharge(s, ENERGY_MS * 3 + 5);
  assert.equal(s.energy, 13);
  s.energy = 0; s.energyAt = 0;
  assert.equal(sleepDay(s, 5000).ok, false);
  recharge(s, ENERGY_MS * 2 + 1);
  assert.equal(s.energy, 2);
  assert.ok(msUntilEnergy(s, ENERGY_MS * 2 + 1) > 0);
  recharge(s, ENERGY_MS * 100);
  assert.equal(s.energy, MAX_ENERGY);
});

test("nuit : le jour avance, la nourriture et l'eau sont consommées", () => {
  const s = farm();
  buyHen(s, "young"); buyHen(s, "young");
  fillFeeder(s); fillWater(s);
  const food = s.feederStock, water = s.waterStock;
  night(s);
  assert.equal(s.day, 2);
  assert.equal(s.feederStock, food - 2);
  assert.equal(s.waterStock, water - 2);
  assert.ok(s.recap && s.recap.day === 1);
});

test("sans nourriture les poules ne meurent jamais, même après de longues semaines", () => {
  const s = farm();
  buyHen(s, "rescue"); buyHen(s, "young");
  for (let i = 0; i < 120; i++) { night(s, i); }
  assert.equal(s.hens.length, 2);
  for (const h of s.hens) assert.ok(h.health >= 5);
});

test("la mortalité naturelle est désactivée par défaut et fonctionne si activée", () => {
  const s = farm();
  buyHen(s, "rescue");
  s.hens[0].age = 4000;
  for (let i = 0; i < 5; i++) night(s, i);
  assert.equal(s.hens.length, 1);
  s.settings.mortality = true;
  for (let i = 0; i < 20 && s.hens.length; i++) night(s, i);
  assert.equal(s.hens.length, 0);
});

test("ponte : surprise, œufs dans nids ou herbe, jamais d'identité exposée côté UI", () => {
  const s = farm(7);
  for (let i = 0; i < 5; i++) buyHen(s, "young");
  fillFeeder(s); fillWater(s);
  let total = 0;
  for (let d = 0; d < 6; d++) { fillFeeder(s); s.feedReserve = 40; fillWater(s); night(s, d); }
  total = s.eggs.length;
  assert.ok(total > 8, "des œufs doivent avoir été pondus : " + total);
  assert.ok(s.eggs.every((e) => e.motherId && ["nest", "grass"].includes(e.status)));
  assert.ok(s.eggs.every((e) => e.status !== "nest" || (e.nest >= 0 && e.nest < 3)));
  assert.ok(s.eggs.every((e) => e.fertilized === false), "pas de coq : aucun œuf fécondé");
});

test("la quantité d'œufs varie d'une nuit à l'autre (pas de ponte fixe)", () => {
  const s = farm(11);
  for (let i = 0; i < 6; i++) buyHen(s, "young");
  const counts = new Set();
  for (let d = 0; d < 12; d++) {
    const before = s.eggs.length;
    s.feederStock = 40; s.waterStock = 30; s.cleanliness = 100;
    night(s, d);
    counts.add(s.eggs.length - before);
  }
  assert.ok(counts.size >= 3, "variation attendue : " + [...counts]);
});

test("poussins : aucune ponte avant l'âge, une poule de réforme pond moins qu'une jeune poule", () => {
  const a = farm(3), b = farm(3), c = farm(3);
  for (let i = 0; i < 5; i++) { buyHen(a, "chick"); buyHen(b, "young"); buyHen(c, "rescue"); }
  for (let d = 0; d < 10; d++) for (const s of [a, b, c]) { s.feederStock = 40; s.waterStock = 30; s.cleanliness = 100; night(s, d); }
  const laid = (s) => s.hens.reduce((n, h) => n + h.eggsLaid, 0);
  assert.ok(laid(a) < laid(b)); // les poussins n'ont commencé qu'après 20 jours d'âge
  assert.ok(laid(c) < laid(b));
  assert.ok(laid(c) > 0);
});

test("nids sales ou surpeuplement augmentent les œufs cachés dans l'herbe", () => {
  const s = farm();
  s.cleanliness = 100;
  const base = hiddenChance(s);
  s.cleanliness = 20;
  assert.ok(hiddenChance(s) > base + 0.2);
  s.cleanliness = 100;
  for (let i = 0; i < 9; i++) buyHen(s, "young");
  assert.ok(hiddenChance(s) > base);
});

test("récolte : un œuf à la fois, une seule fois, et le stock augmente", () => {
  const s = farm(5);
  buyHen(s, "young");
  const hen = s.hens[0];
  const e = layEgg(s, hen);
  assert.ok(collectEgg(s, e.id).ok);
  assert.equal(storedEggs(s), 1);
  assert.equal(collectEgg(s, e.id).ok, false);
  assert.equal(s.stats.eggsCollected, 1);
});

test("couvaison : marquer / démarquer, éclosion généalogique avec un coq, œuf clair sans coq", () => {
  const s = farm(9);
  buyHen(s, "young");
  const mother = s.hens[0];
  const e = layEgg(s, mother);
  e.status = "nest"; e.nest = 0;
  assert.ok(toggleBrood(s, e.id).ok);
  assert.equal(e.status, "brood");
  assert.ok(toggleBrood(s, e.id).ok);
  assert.equal(e.status, "nest");
  // sans coq : l'œuf est retiré après 7 jours
  toggleBrood(s, e.id);
  const lines = [];
  for (let i = 0; i < 7; i++) advanceBrooding(s, lines);
  assert.equal(s.eggs.length, 0);
  // avec un coq : un poussin naît (généalogie conservée)
  const t = farm(9);
  buyHen(t, "young");
  t.hens.push({ ...t.hens[0], id: "rooster1", sex: "rooster", age: 200, name: "Coco" });
  const f = layEgg(t, t.hens[0]);
  f.status = "brood"; f.nest = 1; f.fertilized = true; f.fatherId = "rooster1";
  for (let i = 0; i < 40 && t.hens.length < 3; i++) {
    f.broodDays = 0; f.status = "brood";
    if (!t.eggs.includes(f)) t.eggs.push(f);
    for (let d = 0; d < 7; d++) advanceBrooding(t, lines);
  }
  const chick = t.hens.find((h) => h.motherId === t.hens[0].id);
  assert.ok(chick, "un poussin doit naître");
  assert.equal(chick.fatherId, "rooster1");
  assert.equal(chick.age, 0);
});

test("caresses : répétables, gains plafonnés par jour, remis à zéro par la nuit", () => {
  const s = farm();
  buyHen(s, "young");
  const h = s.hens[0];
  const a0 = h.affection;
  for (let i = 0; i < 20; i++) petHen(s, h.id);
  const gain = h.affection - a0;
  assert.ok(gain > 0 && gain <= 4.0001, "plafond respecté : " + gain);
  const r = petHen(s, h.id);
  assert.ok(r.capped);
  night(s);
  const a1 = h.affection;
  petHen(s, h.id);
  assert.ok(h.affection > a1);
});

test("soins : coûtent 16 pièces, guérissent, et sont refusés sur une poule en bonne santé", () => {
  const s = farm();
  buyHen(s, "young");
  const h = s.hens[0];
  assert.equal(careHen(s, h.id).ok, false);
  h.sick = true; h.health = 30;
  const coins = s.coins;
  assert.ok(careHen(s, h.id).ok);
  assert.equal(s.coins, coins - 16);
  assert.equal(h.sick, false);
  assert.ok(h.health > 30);
});

test("euthanasie : uniquement pour une situation grave et volontaire", () => {
  const s = farm();
  buyHen(s, "young");
  const h = s.hens[0];
  assert.equal(euthanize(s, h.id).ok, false);
  h.sick = true; h.health = 10; h.sickDays = 4;
  assert.ok(canEuthanize(h));
  assert.ok(euthanize(s, h.id).ok);
  assert.equal(s.hens.length, 0);
});

test("la maladie existe mais une poule malade ne meurt pas seule et peut guérir", () => {
  const s = farm(21);
  for (let i = 0; i < 3; i++) buyHen(s, "young");
  s.cleanliness = 0;
  let sickSeen = false;
  for (let d = 0; d < 80; d++) {
    s.feederStock = 40; s.waterStock = 30;
    night(s, d);
    if (s.hens.some((h) => h.sick)) sickSeen = true;
    s.cleanliness = Math.min(s.cleanliness, 30);
  }
  assert.ok(sickSeen, "au moins une maladie en 80 nuits sales");
  assert.equal(s.hens.length, 3);
});

test("entretien : remplir mangeoire / abreuvoir / nettoyer, limites respectées", () => {
  const s = farm();
  assert.ok(fillWater(s).ok);
  assert.equal(fillWater(s).ok, false);
  assert.ok(fillFeeder(s).ok);
  assert.equal(s.feedReserve, 0);
  assert.equal(fillFeeder(s).ok, false);
  assert.ok(buyFeed(s).ok);
  s.cleanliness = 30;
  assert.ok(cleanCoop(s).ok);
  assert.equal(s.cleanliness, 100);
  assert.equal(cleanCoop(s).ok, false); // une fois par jour
  night(s);
  assert.ok(cleanCoop(s).ok);
});

test("le jour de marché est le dimanche (jour 7)", () => {
  const s = farm();
  for (let i = 0; i < 6; i++) { assert.equal(isMarketDay(s), false); night(s, i); }
  assert.equal(isMarketDay(s), true);
  assert.equal(dayName(s), "Dimanche");
});

function marketReady(seed = 2) {
  const s = farm(seed);
  buyHen(s, "young");
  for (let i = 0; i < 6; i++) night(s, i);
  s.eggs = [];
  for (let i = 0; i < 8; i++) s.eggs.push({ id: "e" + i, status: "stored", motherId: "x", fertilized: false });
  return s;
}

test("marché : fermé hors dimanche, ouvert une fois, prix et clients, argent encaissé", () => {
  const s = farm();
  assert.equal(openMarket(s, 4).ok, false);
  const t = marketReady();
  assert.ok(isMarketDay(t));
  assert.equal(openMarket(t, 99).ok, false);
  const coins = t.coins;
  const r = openMarket(t, referencePrice(t) - 1);
  assert.ok(r.ok);
  let guard = 0;
  while (t.market.session && guard++ < 30) {
    const v = currentVisitor(t);
    assert.ok(v);
    marketDecision(t, guard % 2 ? "accept" : "counter");
  }
  assert.equal(t.market.session, null);
  assert.ok(t.market.last.sold > 0);
  assert.equal(t.coins, coins + t.market.last.earned);
  assert.equal(storedEggs(t), 8 - t.market.last.sold);
  assert.equal(openMarket(t, 3).ok, false, "un seul stand par dimanche");
});

test("marché : un prix très haut attire moins de clients qu'un prix bas", () => {
  let low = 0, high = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const a = marketReady(seed), b = marketReady(seed);
    openMarket(a, 1); openMarket(b, 12);
    low += a.market.session ? a.market.session.visitors.length : 0;
    high += b.market.session ? b.market.session.visitors.length : 0;
  }
  assert.ok(low > high, `${low} > ${high}`);
});

test("marché : refuser ou fermer le stand ne vend rien", () => {
  const t = marketReady();
  openMarket(t, 4);
  marketDecision(t, "skip");
  const eggs = storedEggs(t);
  closeMarket(t);
  assert.equal(storedEggs(t), eggs);
  assert.equal(t.market.session, null);
});

test("sauvegarde : aller-retour JSON complet, y compris l'aléatoire (pas de re-tirage au rechargement)", () => {
  const s = farm(77);
  for (let i = 0; i < 4; i++) buyHen(s, "young");
  s.feederStock = 40; s.waterStock = 30;
  const copy = deserialize(serialize(s));
  assert.deepEqual(copy, s);
  night(s, 1); night(copy, 1);
  assert.deepEqual(copy.eggs, s.eggs, "même résultat après rechargement");
  assert.equal(deserialize('{"version":1}'), null);
});

test("chargement : stockage vide ou corrompu = nouvelle partie", () => {
  const store = { v: null, getItem() { return this.v; }, setItem(k, v) { this.v = v; } };
  assert.equal(G.loadGame(store).day, 1);
  store.v = "{pas du json";
  assert.equal(G.loadGame(store).coins, 280);
  const s = farm();
  G.saveGame(s, store);
  assert.equal(G.loadGame(store).buildings.length, 4);
});

test("renommer une poule et écrire un carnet", () => {
  const s = farm();
  buyHen(s, "young");
  const id = s.hens[0].id;
  assert.ok(G.renameHen(s, id, "  Bijou  ").ok);
  assert.equal(s.hens[0].name, "Bijou");
  assert.equal(G.renameHen(s, id, "   ").ok, false);
  assert.ok(G.setNotes(s, id, "Aime le maïs").ok);
  assert.equal(s.hens[0].notes, "Aime le maïs");
});

test("boucle complète : construire, acheter, entretenir, pondre, récolter, vendre", () => {
  const s = farm(123);
  assert.ok(buyHen(s, "young").ok);
  assert.ok(buyHen(s, "young").ok);
  assert.ok(buyHen(s, "rescue").ok);
  let guard = 0;
  while (!isMarketDay(s) && guard++ < 10) {
    fillWater(s); if (s.feedReserve < 10) buyFeed(s); fillFeeder(s); cleanCoop(s);
    for (const h of s.hens) petHen(s, h.id);
    assert.ok(sleepDay(s, guard).ok);
    for (const e of s.eggs.filter((v) => v.status !== "brood")) collectEgg(s, e.id);
  }
  assert.ok(isMarketDay(s));
  const stock = storedEggs(s);
  assert.ok(stock > 0, "des œufs récoltés");
  const coins = s.coins;
  assert.ok(openMarket(s, referencePrice(s)).ok);
  let g = 0;
  while (s.market.session && g++ < 30) marketDecision(s, "accept");
  assert.ok(s.coins > coins, "le marché rapporte de l'argent");
});
