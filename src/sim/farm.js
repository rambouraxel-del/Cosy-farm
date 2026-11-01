// Construction, ravitaillement et achat des animaux.
import {
  BUILDINGS, ANIMALS, FEED_BAG, FEEDER_CAPACITY, WATER_CAPACITY, MAX_HENS, HEN_NAMES, TRAITS,
} from "./data.js";
import { intBetween, pick } from "./rng.js";
import {
  ok, fail, newId, building, hasBuilding, henHomeProblem, capacity,
} from "./state.js";

const MARGIN = 0.4;
const FIELD = 16; // demi-largeur du terrain constructible

function halfOf(kind, level = 1) {
  return kind === "pen" ? BUILDINGS.pen.levels[level - 1].half : null;
}

// Retourne un message d'erreur, ou null si l'emplacement est valide.
export function placementProblem(s, kind, x, z, ignoreId = null, penLevel = 1) {
  const def = BUILDINGS[kind];
  if (!def) return "Installation inconnue.";
  if (!Number.isInteger(x) || !Number.isInteger(z)) return "Emplacement invalide.";
  const others = s.buildings.filter((b) => b.id !== ignoreId);
  const pen = kind === "pen" ? { x, z, half: halfOf("pen", penLevel) } : (() => {
    const p = others.find((b) => b.kind === "pen");
    return p ? { x: p.x, z: p.z, half: halfOf("pen", p.level) } : null;
  })();

  if (kind === "pen") {
    if (Math.abs(x) + pen.half > FIELD || Math.abs(z) + pen.half > FIELD) return "L'enclos dépasse du terrain.";
    for (const b of others) {
      const [hw, hd] = BUILDINGS[b.kind].size;
      const dx = Math.abs(b.x - x), dz = Math.abs(b.z - z);
      const inside = dx + hw <= pen.half - 0.6 && dz + hd <= pen.half - 0.6;
      const outside = dx - hw >= pen.half + 0.6 || dz - hd >= pen.half + 0.6;
      if (!inside && !outside) return `L'enclos croise ${BUILDINGS[b.kind].name.toLowerCase()} : déplace l'un des deux.`;
    }
    return null;
  }

  const [hw, hd] = def.size;
  if (Math.abs(x) + hw > FIELD || Math.abs(z) + hd > FIELD) return "Place l'installation sur le terrain.";
  for (const b of others) {
    if (b.kind === "pen") continue;
    const [ow, od] = BUILDINGS[b.kind].size;
    if (Math.abs(b.x - x) < hw + ow + MARGIN && Math.abs(b.z - z) < hd + od + MARGIN) return "Trop près d'une autre installation.";
  }
  if (pen) {
    const dx = Math.abs(x - pen.x), dz = Math.abs(z - pen.z);
    const inside = dx + hw <= pen.half - 0.6 && dz + hd <= pen.half - 0.6;
    const outside = dx - hw >= pen.half + 0.6 || dz - hd >= pen.half + 0.6;
    if (!inside && !outside) return "Ne place pas l'installation sur la clôture.";
  }
  return null;
}

export function buyBuilding(s, kind, x, z) {
  const def = BUILDINGS[kind];
  if (!def) return fail("Installation inconnue.");
  if (hasBuilding(s, kind)) return fail("Tu as déjà cette installation.");
  const price = def.levels[0].price;
  if (s.coins < price) return fail("Pas assez de pièces.");
  const problem = placementProblem(s, kind, x, z);
  if (problem) return fail(problem);
  s.coins -= price;
  const b = { id: newId(s), kind, x, z, level: 1 };
  s.buildings.push(b);
  return ok(`${def.name} installé.`, { building: b });
}

export function moveBuilding(s, id, x, z) {
  const b = s.buildings.find((v) => v.id === id);
  if (!b) return fail("Installation introuvable.");
  if (b.kind === "pen") return fail("L'enclos ne peut pas être déplacé.");
  const problem = placementProblem(s, b.kind, x, z, id);
  if (problem) return fail(problem);
  b.x = x; b.z = z;
  return ok(`${BUILDINGS[b.kind].name} déplacé.`);
}

export function upgradePrice(s, kind) {
  const b = building(s, kind);
  const def = BUILDINGS[kind];
  if (!b || b.level >= def.levels.length) return null;
  return def.levels[b.level].price;
}
export function upgradeBuilding(s, kind) {
  const b = building(s, kind);
  if (!b) return fail("Installe-le d'abord.");
  const price = upgradePrice(s, kind);
  if (price == null) return fail("Déjà au niveau maximum.");
  if (s.coins < price) return fail("Pas assez de pièces.");
  if (kind === "pen") {
    const problem = placementProblem(s, "pen", b.x, b.z, b.id, b.level + 1);
    if (problem) return fail(problem);
  }
  s.coins -= price;
  b.level += 1;
  return ok(`${BUILDINGS[kind].name} agrandi.`);
}

// ---- Ravitaillement --------------------------------------------------------
export function buyFeed(s) {
  if (s.coins < FEED_BAG.price) return fail("Pas assez de pièces.");
  s.coins -= FEED_BAG.price;
  s.feedReserve += FEED_BAG.rations;
  return ok(`+${FEED_BAG.rations} rations de graines.`);
}
export function fillFeeder(s) {
  if (!hasBuilding(s, "feeder")) return fail("Installe d'abord une mangeoire.");
  if (s.feederStock >= FEEDER_CAPACITY) return fail("La mangeoire est pleine.");
  if (s.feedReserve <= 0) return fail("Plus de graines en réserve : achète un sac.");
  const n = Math.min(s.feedReserve, FEEDER_CAPACITY - s.feederStock);
  s.feedReserve -= n; s.feederStock += n;
  return ok(`Mangeoire remplie (+${n}).`);
}
export function fillWater(s) {
  if (!hasBuilding(s, "water")) return fail("Installe d'abord un abreuvoir.");
  if (s.waterStock >= WATER_CAPACITY) return fail("L'abreuvoir est plein.");
  s.waterStock = WATER_CAPACITY;
  return ok("Eau fraîche remplie.");
}
export function cleanCoop(s) {
  if (!hasBuilding(s, "coop")) return fail("Installe d'abord un poulailler.");
  if (s.cleanedDay === s.day) return fail("Le poulailler est déjà propre pour aujourd'hui.");
  s.cleanedDay = s.day;
  s.cleanliness = 100;
  return ok("Litière fraîche : les nids sont propres.");
}

// ---- Poules ----------------------------------------------------------------
export function createHen(s, kind, { name, motherId = null, fatherId = null, age } = {}) {
  const def = ANIMALS[kind] || ANIMALS.chick;
  const usedNames = new Set(s.hens.map((h) => h.name));
  const free = HEN_NAMES.filter((n) => !usedNames.has(n));
  const traitKeys = Object.keys(TRAITS);
  const trait = pick(s, traitKeys);
  const fresh = kind === "rescue";
  return {
    id: newId(s),
    name: name || (free.length ? pick(s, free) : pick(s, HEN_NAMES) + " " + (s.nextId)),
    origin: kind,
    sex: "hen", // le coq est prévu par l'architecture (reproduction à venir)
    age: age ?? (Array.isArray(def.age) ? intBetween(s, def.age[0], def.age[1]) : def.age),
    arrivedDay: s.day,
    trait,
    satiety: 80, hydration: 80, health: fresh ? 70 : 90, happiness: fresh ? 45 : 65,
    cleanliness: 90, stress: fresh ? 45 : 30, social: 55,
    trust: fresh ? 5 : 15, affection: 0,
    sick: false, sickDays: 0, symptom: "",
    eggsLaid: 0, notes: "",
    motherId, fatherId,
    today: { affection: 0, trust: 0, pets: 0, cared: false },
    history: [{ day: s.day, text: kind === "chick" && motherId ? "Est née à la ferme." : "Est arrivée à la ferme." }],
  };
}
export function buyHen(s, kind) {
  const def = ANIMALS[kind];
  if (!def) return fail("Animal inconnu.");
  const problem = henHomeProblem(s);
  if (problem) return fail(problem);
  if (s.coins < def.price) return fail("Pas assez de pièces.");
  if (s.hens.length >= MAX_HENS) return fail(`Limite de ${MAX_HENS} poules pour cette version.`);
  s.coins -= def.price;
  const h = createHen(s, kind);
  s.hens.push(h);
  const crowded = s.hens.length > capacity(s);
  return ok(`${h.name} rejoint la ferme !` + (crowded ? " Attention : ta ferme est surpeuplée." : ""), { hen: h });
}

export const findHen = (s, id) => s.hens.find((h) => h.id === id) || null;
export function renameHen(s, id, name) {
  const h = findHen(s, id);
  if (!h) return fail("Poule introuvable.");
  const clean = String(name ?? "").trim().slice(0, 24);
  if (!clean) return fail("Le prénom ne peut pas être vide.");
  h.name = clean;
  return ok();
}
export function setNotes(s, id, text) {
  const h = findHen(s, id);
  if (!h) return fail("Poule introuvable.");
  h.notes = String(text ?? "").slice(0, 4000);
  return ok();
}
