// Ponte, récolte, couvaison. L'identité de la mère est conservée dans l'œuf
// (généalogie future) mais n'est jamais affichée au joueur.
import { BUILDINGS, BROOD_DAYS } from "./data.js";
import { rand, chance, between } from "./rng.js";
import {
  ok, fail, newId, building, coopNests, penHalf, capacity,
} from "./state.js";
import { createHen } from "./farm.js";
import { logHen } from "./hens.js";

const NEST_SLOTS = 3;

export const hasRooster = (s) => s.hens.some((h) => h.sex === "rooster" && h.age >= 30);

function nestLoad(s) {
  const loads = Array.from({ length: coopNests(s) }, () => 0);
  for (const e of s.eggs) if ((e.status === "nest" || e.status === "brood") && e.nest != null) loads[e.nest] += 1;
  return loads;
}

function grassSpot(s) {
  const pen = building(s, "pen");
  const cx = pen ? pen.x : 0, cz = pen ? pen.z : 0, half = penHalf(s) || 4;
  for (let i = 0; i < 20; i++) {
    const a = rand(s) * Math.PI * 2, r = between(s, 1.2, half + 3);
    const x = Math.round((cx + Math.cos(a) * r) * 2) / 2, z = Math.round((cz + Math.sin(a) * r) * 2) / 2;
    if (Math.abs(x) > 15 || Math.abs(z) > 15) continue;
    const blocked = s.buildings.some((b) => {
      if (b.kind === "pen") return false;
      const [hw, hd] = BUILDINGS[b.kind].size;
      return Math.abs(b.x - x) < hw + 0.6 && Math.abs(b.z - z) < hd + 0.6;
    });
    if (!blocked) return { x, z };
  }
  return { x: cx + half + 1, z: cz };
}

// Probabilité qu'une poule pondeuse laisse son œuf hors des nids.
export function hiddenChance(s) {
  let p = 0.03;
  if (s.cleanliness < 40) p += 0.3;
  else if (s.cleanliness < 65) p += 0.1;
  const cap = capacity(s);
  if (cap && s.hens.length > cap) p += Math.min(0.4, 0.15 * (s.hens.length - cap));
  return Math.min(0.85, p);
}

export function layEgg(s, hen) {
  const rooster = s.hens.filter((h) => h.sex === "rooster" && h.age >= 30);
  const father = rooster.length ? rooster[Math.floor(rand(s) * rooster.length)] : null;
  const egg = {
    id: newId(s), status: "nest", nest: null, x: 0, z: 0,
    laidDay: s.day, motherId: hen.id, fatherId: father ? father.id : null,
    fertilized: !!father && chance(s, 0.9), broodDays: 0,
  };
  const loads = nestLoad(s);
  const open = loads.map((n, i) => ({ n, i })).filter((v) => v.n < NEST_SLOTS);
  if (!open.length || chance(s, hiddenChance(s))) {
    egg.status = "grass";
    Object.assign(egg, grassSpot(s));
  } else {
    // nid le moins rempli, au hasard en cas d'égalité
    const min = Math.min(...open.map((v) => v.n));
    const ties = open.filter((v) => v.n === min);
    egg.nest = ties[Math.floor(rand(s) * ties.length)].i;
  }
  hen.eggsLaid += 1;
  s.eggs.push(egg);
  return egg;
}

export function collectEgg(s, id) {
  const e = s.eggs.find((v) => v.id === id);
  if (!e || (e.status !== "nest" && e.status !== "grass")) return fail("Il n'y a plus d'œuf ici.");
  e.status = "stored"; e.nest = null;
  s.stats.eggsCollected += 1;
  return ok("Œuf récolté !", { egg: e });
}

// Marquer / démarquer un œuf pour la couvaison.
export function toggleBrood(s, id) {
  const e = s.eggs.find((v) => v.id === id);
  if (!e) return fail("Œuf introuvable.");
  if (e.status === "nest") { e.status = "brood"; e.broodDays = 0; return ok("Œuf marqué : il sera laissé à couver."); }
  if (e.status === "brood") { e.status = "nest"; e.broodDays = 0; return ok("Œuf démarqué."); }
  return fail("Cet œuf ne peut pas être couvé.");
}

// Appelée à chaque nuit : fait avancer la couvaison.
export function advanceBrooding(s, lines) {
  for (const e of s.eggs.filter((v) => v.status === "brood")) {
    e.broodDays += 1;
    if (e.broodDays < BROOD_DAYS) continue;
    if (e.fertilized && chance(s, 0.85)) {
      const mother = s.hens.find((h) => h.id === e.motherId);
      const chick = createHen(s, "chick", { motherId: e.motherId, fatherId: e.fatherId, age: 0 });
      s.hens.push(chick);
      if (mother) logHen(s, mother, `Son œuf a éclos : ${chick.name} est née.`);
      lines.push(`Un poussin est né : ${chick.name} !`);
      e.status = "hatched";
    } else {
      e.status = "clear"; // non fécondé ou n'a pas éclos : retiré du nid
      lines.push("Un œuf couvé n'a rien donné : il a été retiré du nid.");
    }
  }
  s.eggs = s.eggs.filter((e) => e.status !== "hatched" && e.status !== "clear");
}
