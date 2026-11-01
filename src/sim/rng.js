// Générateur pseudo-aléatoire dont l'état vit dans la sauvegarde (s.rng) :
// recharger l'application ne permet donc pas de "relancer" la ponte.
export function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const chance = (s, p) => rand(s) < p;
export const between = (s, a, b) => a + rand(s) * (b - a);
export const intBetween = (s, a, b) => Math.floor(between(s, a, b + 1));
export const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
export function shuffle(s, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Aléatoire déterministe à partir d'une graine (prix hebdomadaires).
export function hashRand(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
