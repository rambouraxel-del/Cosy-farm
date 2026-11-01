import {
  SAVE_VERSION, MAX_ENERGY, ENERGY_MS, START_COINS, WEEK, BUILDINGS,
} from "./data.js";

export const SAVE_KEY = "cosy-farm-save";

export const ok = (msg = "", data = {}) => ({ ok: true, msg, ...data });
export const fail = (msg) => ({ ok: false, msg });
export const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export function createGame(now = Date.now(), seed = (now ^ 0x5f3759df) | 0) {
  return {
    version: SAVE_VERSION,
    rng: seed,
    seed,
    nextId: 1,
    day: 1,
    coins: START_COINS,
    energy: MAX_ENERGY,
    energyAt: now,
    buildings: [],
    hens: [],
    eggs: [],
    feedReserve: 20, // un sac offert pour démarrer (en rations)
    feederStock: 0,
    waterStock: 0,
    cleanliness: 100,
    cleanedDay: 0,
    reputation: 0,
    market: { doneDay: 0, session: null, last: null },
    recap: null,
    settings: { mortality: false },
    stats: { eggsCollected: 0, eggsSold: 0, coinsEarned: 0, nights: 0 },
  };
}

export const newId = (s) => String(s.nextId++);
export const dayName = (s) => WEEK[(s.day - 1) % 7];
export const isMarketDay = (s) => (s.day - 1) % 7 === 6;
export const daysUntilMarket = (s) => (isMarketDay(s) ? 0 : 6 - ((s.day - 1) % 7));
export const weekIndex = (s) => Math.floor((s.day - 1) / 7);

export const building = (s, kind) => s.buildings.find((b) => b.kind === kind) || null;
export const hasBuilding = (s, kind) => !!building(s, kind);
export const buildingLevel = (s, kind) => building(s, kind)?.level ?? 0;
export const penHalf = (s) => {
  const b = building(s, "pen");
  return b ? BUILDINGS.pen.levels[b.level - 1].half : 0;
};
export const coopNests = (s) => {
  const b = building(s, "coop");
  return b ? BUILDINGS.coop.levels[b.level - 1].nests : 0;
};
export function capacity(s) {
  const pen = building(s, "pen"), coop = building(s, "coop");
  if (!pen || !coop) return 0;
  return Math.min(BUILDINGS.pen.levels[pen.level - 1].cap, BUILDINGS.coop.levels[coop.level - 1].cap);
}
// Le bétail ne s'installe que si les 4 installations existent et si le poulailler,
// la mangeoire et l'abreuvoir sont à l'intérieur de l'enclos.
export function insidePen(s, b) {
  const pen = building(s, "pen");
  if (!pen) return false;
  const h = BUILDINGS.pen.levels[pen.level - 1].half - 0.5;
  const [hw, hd] = BUILDINGS[b.kind].size || [0, 0];
  return Math.abs(b.x - pen.x) + hw <= h && Math.abs(b.z - pen.z) + hd <= h;
}
export function henHomeProblem(s) {
  for (const k of ["pen", "coop", "feeder", "water"]) {
    if (!hasBuilding(s, k)) return "Installe d'abord l'enclos, le poulailler, la mangeoire et l'abreuvoir.";
  }
  for (const k of ["coop", "feeder", "water"]) {
    if (!insidePen(s, building(s, k))) return "Le poulailler, la mangeoire et l'abreuvoir doivent être à l'intérieur de l'enclos.";
  }
  return null;
}
export const storedEggs = (s) => s.eggs.filter((e) => e.status === "stored").length;
export const eggsInNests = (s) => s.eggs.filter((e) => e.status === "nest" || e.status === "brood");
export const eggsOnGrass = (s) => s.eggs.filter((e) => e.status === "grass");

// ---- Énergie ----------------------------------------------------------------
export function recharge(s, now = Date.now()) {
  if (!Number.isFinite(s.energyAt)) s.energyAt = now;
  if (s.energy >= MAX_ENERGY) { s.energy = MAX_ENERGY; s.energyAt = now; return; }
  const ticks = Math.floor(Math.max(0, now - s.energyAt) / ENERGY_MS);
  if (ticks > 0) {
    s.energy = Math.min(MAX_ENERGY, s.energy + ticks);
    s.energyAt = s.energy >= MAX_ENERGY ? now : s.energyAt + ticks * ENERGY_MS;
  }
}
export function msUntilEnergy(s, now = Date.now()) {
  if (s.energy >= MAX_ENERGY) return 0;
  return Math.max(0, ENERGY_MS - (Math.max(0, now - s.energyAt) % ENERGY_MS));
}
export function formatCountdown(ms) {
  const sec = Math.ceil(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// ---- Sauvegarde -------------------------------------------------------------
export function serialize(s) { return JSON.stringify(s); }
export function deserialize(text) {
  const s = JSON.parse(text);
  if (!s || s.version !== SAVE_VERSION) return null;
  if (!Array.isArray(s.hens) || !Array.isArray(s.buildings) || !Array.isArray(s.eggs)) return null;
  // Valeurs par défaut pour d'éventuels champs ajoutés plus tard.
  const base = createGame(Date.now(), s.seed);
  const merged = { ...base, ...s, settings: { ...base.settings, ...s.settings }, stats: { ...base.stats, ...s.stats },
    market: { ...base.market, ...s.market } };
  return merged;
}
export function loadGame(storage = globalThis.localStorage) {
  try {
    const text = storage?.getItem(SAVE_KEY);
    if (text) {
      const s = deserialize(text);
      if (s) { recharge(s); return s; }
    }
  } catch (_) { /* sauvegarde illisible : nouvelle partie */ }
  return createGame();
}
export function saveGame(s, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, serialize(s)); return true; } catch (_) { return false; }
}
export function resetGame(storage = globalThis.localStorage) {
  try { storage.removeItem(SAVE_KEY); } catch (_) { /* ignoré */ }
  return createGame();
}
