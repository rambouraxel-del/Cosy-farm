// Modèles 3D très simples (formes primitives, matériaux plats).
import * as THREE from "three";
import { BUILDINGS } from "../sim/data.js";

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  return matCache.get(key);
}
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  prism: (() => { // toit à deux pans (prisme triangulaire, arête le long de X)
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
    g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);
    return g;
  })(),
};
function part(kind, color, [sx, sy, sz], [x, y, z] = [0, 0, 0], parent, rot) {
  const m = new THREE.Mesh(geo[kind], typeof color === "string" || typeof color === "number" ? mat(color) : color);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  if (rot) m.rotation.set(...rot);
  if (parent) parent.add(m);
  return m;
}

// ---- Poules ----------------------------------------------------------------
const HEN_PALETTES = [
  { body: 0xf4ead8, wing: 0xe3d3b6 }, // blanche
  { body: 0xc98a52, wing: 0xa8693a }, // rousse
  { body: 0xe8b95a, wing: 0xcf9a3c }, // dorée
  { body: 0x8d8a86, wing: 0x6f6c68 }, // grise
  { body: 0x5b4636, wing: 0x45342a }, // brune
  { body: 0xd9a47c, wing: 0xb98059 }, // sable
];
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function henScale(h) { return h.age < 18 ? 0.45 + 0.4 * (h.age / 18) : h.age < 40 ? 0.85 + 0.15 * ((h.age - 18) / 22) : 1; }

export function makeHen(h) {
  const root = new THREE.Group();
  const inner = new THREE.Group(); inner.name = "inner"; root.add(inner);
  const chick = h.age < 18;
  const pal = chick ? { body: 0xffe27a, wing: 0xf3cf55 } : HEN_PALETTES[hashStr(h.id + h.name) % HEN_PALETTES.length];
  const body = pal.body, wing = pal.wing;
  part("sphere", body, [0.85, 0.75, 1.1], [0, 0.55, 0], inner);
  part("sphere", wing, [0.18, 0.45, 0.75], [0.34, 0.58, -0.02], inner);
  part("sphere", wing, [0.18, 0.45, 0.75], [-0.34, 0.58, -0.02], inner);
  part("cone", wing, [0.35, 0.55, 0.3], [0, 0.82, -0.55], inner, [-1.0, 0, 0]);
  const head = new THREE.Group(); head.name = "head"; head.position.set(0, 0.92, 0.36); inner.add(head);
  part("sphere", body, [0.4, 0.4, 0.4], [0, 0.05, 0.02], head);
  part("cone", 0xf2a33a, [0.14, 0.22, 0.14], [0, 0.0, 0.26], head, [Math.PI / 2, 0, 0]);
  if (!chick) {
    part("sphere", 0xd9473f, [0.1, 0.16, 0.2], [0, 0.26, 0.02], head);
    part("sphere", 0xd9473f, [0.07, 0.12, 0.07], [0, -0.14, 0.2], head);
  }
  part("sphere", 0x2b2118, [0.07, 0.07, 0.07], [0.15, 0.08, 0.12], head);
  part("sphere", 0x2b2118, [0.07, 0.07, 0.07], [-0.15, 0.08, 0.12], head);
  part("cyl", 0xf2a33a, [0.05, 0.3, 0.05], [0.14, 0.15, 0.05], inner);
  part("cyl", 0xf2a33a, [0.05, 0.3, 0.05], [-0.14, 0.15, 0.05], inner);
  // zone de toucher généreuse pour les doigts
  const hit = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ visible: false }));
  hit.scale.set(1.6, 1.6, 1.6); hit.position.y = 0.7; hit.userData = { type: "hen", id: h.id }; root.add(hit);
  // ombre douce
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x2f4a2a, transparent: true, opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(1.1, 1.4, 1); root.add(shadow);
  root.scale.setScalar(henScale(h));
  root.userData = { head, inner, hit };
  return root;
}

export function makeEgg(color = 0xfff3dc) {
  const g = new THREE.Group();
  const e = new THREE.Mesh(geo.sphere, mat(color, { flatShading: false, emissive: 0x4a4233 }));
  e.scale.set(0.34, 0.46, 0.34); e.position.y = 0.23; g.add(e);
  return g;
}

// ---- Sprites (bulles) -------------------------------------------------------
function canvasSprite(draw, size = 64) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
}
let heartTex, plusTex;
export function makeHeart() {
  const s = canvasSprite((ctx, n) => {
    ctx.fillStyle = "#ff6f91"; ctx.beginPath();
    ctx.moveTo(n / 2, n * 0.85);
    ctx.bezierCurveTo(n * 0.05, n * 0.55, n * 0.15, n * 0.1, n / 2, n * 0.32);
    ctx.bezierCurveTo(n * 0.85, n * 0.1, n * 0.95, n * 0.55, n / 2, n * 0.85);
    ctx.fill();
  });
  heartTex = heartTex || s.material.map;
  s.material.map = heartTex; s.scale.set(0.6, 0.6, 1);
  return s;
}
export function makeSickBubble() {
  const s = canvasSprite((ctx, n) => {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(n / 2, n / 2, n * 0.42, 0, 7); ctx.fill();
    ctx.fillStyle = "#e0584f"; ctx.fillRect(n * 0.43, n * 0.22, n * 0.14, n * 0.56); ctx.fillRect(n * 0.22, n * 0.43, n * 0.56, n * 0.14);
  });
  plusTex = plusTex || s.material.map;
  s.material.map = plusTex; s.scale.set(0.7, 0.7, 1);
  return s;
}

// ---- Bâtiments --------------------------------------------------------------
const WOOD = 0xd9b779, DARK = 0x8a5a3c, RED = 0xc4694a, ROOF = 0x7d4a38;

export function makePen(level = 1) {
  const g = new THREE.Group();
  const h = BUILDINGS.pen.levels[level - 1].half;
  const post = (x, z) => part("box", WOOD, [0.2, 1.0, 0.2], [x, 0.5, z], g);
  for (let i = -h; i <= h; i += 1) {
    if (Math.abs(i % 2) === Math.abs(h % 2)) { post(i, -h); post(i, h); post(-h, i); post(h, i); }
  }
  for (const y of [0.35, 0.75]) {
    part("box", WOOD, [2 * h, 0.08, 0.07], [0, y, -h], g);
    part("box", WOOD, [2 * h, 0.08, 0.07], [0, y, h], g);
    part("box", WOOD, [0.07, 0.08, 2 * h], [-h, y, 0], g);
    part("box", WOOD, [0.07, 0.08, 2 * h], [h, y, 0], g);
  }
  return g;
}
export function makeCoop(level = 1) {
  const g = new THREE.Group();
  part("box", RED, [3.4, 2.0, 2.8], [0, 1.0, 0], g);
  part("box", 0x6e432d, [3.5, 0.15, 2.9], [0, 0.07, 0], g);
  const roof = part("prism", ROOF, [3.9, 1.3, 3.5], [0, 2.55, 0], g);
  roof.rotation.y = 0; 
  part("box", 0x4b2f23, [0.8, 1.2, 0.08], [0, 0.6, 1.42], g);
  part("box", 0xf6e7b4, [0.55, 0.45, 0.08], [1.05, 1.35, 1.42], g);
  part("box", WOOD, [0.9, 0.08, 1.0], [0, 0.18, 1.9], g, [0.28, 0, 0]);
  if (level >= 2) part("box", 0x7a5645, [0.4, 0.9, 0.4], [-1.1, 3.0, -0.3], g);
  if (level >= 3) part("box", RED, [1.4, 1.2, 1.4], [0, 0.6, -2.0], g);
  return g;
}
export function makeFeeder() {
  const g = new THREE.Group();
  part("box", DARK, [2.0, 0.5, 1.5], [0, 0.25, 0], g);
  part("box", 0x5b3a27, [1.7, 0.2, 1.2], [0, 0.5, 0], g);
  const seeds = part("box", 0xf3c862, [1.6, 0.3, 1.1], [0, 0.55, 0], g);
  seeds.name = "fill";
  return g;
}
export function makeWater() {
  const g = new THREE.Group();
  part("box", DARK, [2.0, 0.5, 1.5], [0, 0.25, 0], g);
  part("box", 0x5b3a27, [1.7, 0.2, 1.2], [0, 0.5, 0], g);
  const w = part("box", mat(0x7cc4d4, { transparent: true, opacity: 0.9 }), [1.6, 0.3, 1.1], [0, 0.55, 0], g);
  w.name = "fill";
  return g;
}
export function makeBuilding(kind, level = 1) {
  const g = kind === "pen" ? makePen(level) : kind === "coop" ? makeCoop(level) : kind === "feeder" ? makeFeeder() : makeWater();
  g.userData.kind = kind;
  return g;
}
// Rend un bâtiment translucide (aperçu de placement).
export function ghostify(group, valid) {
  const m = new THREE.MeshLambertMaterial({ color: valid ? 0x6fd48a : 0xe0645a, transparent: true, opacity: 0.55 });
  group.traverse((o) => { if (o.isMesh) o.material = m; });
}

// ---- Décor ------------------------------------------------------------------
export function makeTree(seed = 0) {
  const g = new THREE.Group();
  const s = 0.8 + (seed % 5) * 0.12;
  part("cyl", 0x7b5a3c, [0.35, 1.2, 0.35], [0, 0.6, 0], g);
  part("sphere", seed % 2 ? 0x6fa96b : 0x82b878, [2.0, 1.8, 2.0], [0, 1.9, 0], g);
  part("sphere", seed % 2 ? 0x7fb87a : 0x6fa96b, [1.4, 1.3, 1.4], [0.3, 2.7, 0.1], g);
  g.scale.setScalar(s);
  return g;
}
export function makeFlower(color) {
  const g = new THREE.Group();
  part("cyl", 0x6fa96b, [0.04, 0.3, 0.04], [0, 0.15, 0], g);
  part("sphere", color, [0.16, 0.12, 0.16], [0, 0.32, 0], g);
  return g;
}
