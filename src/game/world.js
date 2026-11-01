// Monde 3D de la ferme : terrain, bâtiments, poules autonomes, caméra tactile.
import * as THREE from "three";
import { BUILDINGS, FEEDER_CAPACITY, WATER_CAPACITY, TRAITS } from "../sim/data.js";
import { building, penHalf } from "../sim/state.js";
import {
  makeHen, makeEgg, makeBuilding, ghostify, makeTree, makeFlower, makeHeart, makeSickBubble, hashStr, henScale,
} from "./models.js";

const rnd = (a, b) => a + Math.random() * (b - a);
const TAP_PX = 10;

export function createWorld(canvas, { onTap }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe6ee);
  scene.fog = new THREE.Fog(0xcfe6ee, 55, 95);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200);
  const cam = { x: 0, z: 0, dist: 30, az: 0.45, elev: 0.95 };
  const LIMITS = { min: 11, max: 46, pan: 14 };
  function placeCamera() {
    const h = Math.cos(cam.elev) * cam.dist;
    camera.position.set(cam.x + Math.sin(cam.az) * h, Math.sin(cam.elev) * cam.dist, cam.z + Math.cos(cam.az) * h);
    camera.lookAt(cam.x, 0, cam.z);
    camera.updateMatrixWorld();
  }

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x9dbf8a, 1.55));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.3);
  sun.position.set(-12, 24, 10); scene.add(sun);

  // ---- terrain
  const grassTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d"); x.fillStyle = "#a9cf8c"; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) { x.fillStyle = Math.random() > 0.5 ? "#9bc57f" : "#b7d99b"; x.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(20, 20);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshLambertMaterial({ color: 0xbfdc9e, transparent: true, opacity: 0.55 }));
  field.rotation.x = -Math.PI / 2; field.position.y = 0.01; scene.add(field);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(34, 34)), new THREE.LineBasicMaterial({ color: 0x8fb774 }));
  edge.rotation.x = -Math.PI / 2; edge.position.y = 0.03; scene.add(edge);

  // décor autour du terrain constructible
  for (let i = 0; i < 38; i++) {
    const a = (i / 38) * Math.PI * 2 + rnd(-0.1, 0.1), r = rnd(22, 36);
    const t = makeTree(i); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(t);
  }
  const flowerColors = [0xffffff, 0xffd166, 0xf28fad, 0xb59cf0];
  for (let i = 0; i < 70; i++) {
    const x = rnd(-17, 17), z = rnd(-17, 17);
    const f = makeFlower(flowerColors[i % 4]); f.position.set(x, 0, z); scene.add(f);
  }

  // ---- contenu synchronisé avec la partie
  const layers = { buildings: new THREE.Group(), eggs: new THREE.Group(), hens: new THREE.Group(), fx: new THREE.Group() };
  Object.values(layers).forEach((l) => scene.add(l));
  let buildingSig = "";
  const actors = new Map(); // id poule -> acteur
  const eggMeshes = new Map();
  const buildingMeshes = new Map();
  let ghost = null;
  let state = null;

  function obstacles() {
    return state.buildings.filter((b) => b.kind !== "pen").map((b) => ({ x: b.x, z: b.z, hw: BUILDINGS[b.kind].size[0] + 0.45, hd: BUILDINGS[b.kind].size[1] + 0.45 }));
  }
  function home() {
    const pen = building(state, "pen");
    return pen ? { x: pen.x, z: pen.z, half: penHalf(state) - 0.8 } : { x: 0, z: 0, half: 5 };
  }

  function sync(s) {
    state = s;
    // bâtiments
    const sig = s.buildings.map((b) => `${b.id}:${b.kind}:${b.level}:${b.x}:${b.z}`).join("|");
    if (sig !== buildingSig) {
      buildingSig = sig;
      layers.buildings.clear(); buildingMeshes.clear();
      for (const b of s.buildings) {
        const g = makeBuilding(b.kind, b.level); g.position.set(b.x, 0, b.z);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        if (b.kind !== "pen") {
          const [hw, hd] = BUILDINGS[b.kind].size;
          hit.scale.set(hw * 2.2, 2.6, hd * 2.2); hit.position.y = 1.2; hit.userData = { type: "building", id: b.id, kind: b.kind };
          g.add(hit);
        }
        layers.buildings.add(g); buildingMeshes.set(b.id, g);
      }
    }
    for (const b of s.buildings) {
      const fill = buildingMeshes.get(b.id)?.getObjectByName("fill");
      if (fill && b.kind === "feeder") { const r = s.feederStock / FEEDER_CAPACITY; fill.visible = r > 0; fill.scale.y = 0.05 + 0.35 * r; fill.position.y = 0.5 + fill.scale.y / 2; }
      if (fill && b.kind === "water") { const r = s.waterStock / WATER_CAPACITY; fill.visible = r > 0; fill.scale.y = 0.05 + 0.3 * r; fill.position.y = 0.5 + fill.scale.y / 2; }
    }
    // poules
    const ids = new Set(s.hens.map((h) => h.id));
    for (const [id, a] of actors) if (!ids.has(id)) { layers.hens.remove(a.root); actors.delete(id); }
    const hm = home();
    for (const h of s.hens) {
      let a = actors.get(h.id);
      const stage = h.age < 18 ? "c" : "h";
      if (a && a.stage !== stage) { layers.hens.remove(a.root); actors.delete(h.id); a = null; }
      if (!a) {
        const root = makeHen(h);
        root.position.set(hm.x + rnd(-hm.half, hm.half) * 0.7, 0, hm.z + rnd(-hm.half, hm.half) * 0.7);
        a = { id: h.id, root, stage, mode: "idle", t: rnd(0.2, 2), tx: 0, tz: 0, speed: rnd(1.0, 1.5), phase: rnd(0, 6), bubble: null, hop: 0 };
        layers.hens.add(root); actors.set(h.id, a);
      }
      a.data = h;
      root_scale(a, h);
      if (h.sick && !a.bubble) { a.bubble = makeSickBubble(); a.bubble.position.set(0, 2.3, 0); a.root.add(a.bubble); }
      if (!h.sick && a.bubble) { a.root.remove(a.bubble); a.bubble = null; }
    }
    // œufs dans l'herbe
    const grass = s.eggs.filter((e) => e.status === "grass");
    const gids = new Set(grass.map((e) => e.id));
    for (const [id, m] of eggMeshes) if (!gids.has(id) && !m.userData.popping) { layers.eggs.remove(m); eggMeshes.delete(id); }
    for (const e of grass) {
      if (eggMeshes.has(e.id)) continue;
      const m = makeEgg(); m.position.set(e.x, 0, e.z); m.rotation.y = hashStr(e.id) % 6;
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.3; hit.userData = { type: "egg", id: e.id }; m.add(hit);
      layers.eggs.add(m); eggMeshes.set(e.id, m);
    }
  }
  function root_scale(a, h) { a.root.scale.setScalar(henScale(h)); }

  // ---- comportements autonomes (purement visuels)
  function chooseGoal(a, dt) {
    const h = a.data, t = TRAITS[h.trait], hm = home();
    const others = [...actors.values()].filter((o) => o !== a);
    const opts = [
      ["wander", 2.5 * t.explore],
      ["rest", 1.8 / t.explore],
      ["eat", 0.8 + (100 - h.satiety) / 18],
      ["drink", 0.4 + (100 - h.hydration) / 25],
      ["social", others.length ? Math.max(0.2, (70 - h.social) / 14) * t.social : 0],
    ];
    let total = opts.reduce((n, o) => n + o[1], 0), r = Math.random() * total, pick = "wander";
    for (const [k, w] of opts) { r -= w; if (r <= 0) { pick = k; break; } }
    const clampX = (x) => Math.max(hm.x - hm.half, Math.min(hm.x + hm.half, x));
    const clampZ = (z) => Math.max(hm.z - hm.half, Math.min(hm.z + hm.half, z));
    a.kind = pick; a.mode = "walk";
    const feeder = building(state, "feeder"), water = building(state, "water");
    if (pick === "eat" && feeder) { a.tx = clampX(feeder.x + rnd(-0.8, 0.8)); a.tz = clampZ(feeder.z + 1.3 + rnd(0, 0.4)); if (state.feederStock <= 0) a.kind = "forage"; }
    else if (pick === "drink" && water) { a.tx = clampX(water.x + rnd(-0.8, 0.8)); a.tz = clampZ(water.z + 1.3 + rnd(0, 0.4)); }
    else if (pick === "social" && others.length) { const o = others[Math.floor(Math.random() * others.length)].root.position; a.tx = clampX(o.x + rnd(-1.2, 1.2)); a.tz = clampZ(o.z + rnd(-1.2, 1.2)); }
    else if (pick === "rest") { a.mode = "idle"; a.t = rnd(2.5, 6); a.kind = "rest"; }
    else { const r2 = 3 * t.explore; a.tx = clampX(a.root.position.x + rnd(-r2, r2)); a.tz = clampZ(a.root.position.z + rnd(-r2, r2)); }
  }
  const emotes = [];
  function emote(henId) {
    const a = actors.get(henId); if (!a) return;
    a.hop = 0.5;
    for (let i = 0; i < 3; i++) {
      const s = makeHeart();
      s.position.set(a.root.position.x + rnd(-0.4, 0.4), 1.6 + i * 0.25, a.root.position.z + rnd(-0.3, 0.3));
      layers.fx.add(s); emotes.push({ s, life: 1.1 + i * 0.15 });
    }
  }
  function pop(eggId, then) { // petite animation de récolte d'un œuf de l'herbe
    const m = eggMeshes.get(eggId); if (!m) return then?.();
    m.userData.popping = true;
    emotes.push({ s: m, life: 0.35, pop: true, then });
  }

  function updateActor(a, dt, time) {
    const r = a.root, inner = r.userData.inner, head = r.userData.head;
    if (a.hop > 0) { a.hop -= dt; inner.position.y = Math.sin((0.5 - a.hop) * 12) * 0.18 * Math.max(0, a.hop * 2); } else inner.position.y = 0;
    if (a.mode === "idle" || a.mode === "peck") {
      a.t -= dt;
      const pecking = a.mode === "peck";
      head.rotation.x = pecking ? 0.9 + Math.sin(time * 14 + a.phase) * 0.35 : a.kind === "rest" ? Math.sin(time * 1.5 + a.phase) * 0.05 : 0;
      inner.rotation.z = 0;
      if (a.t <= 0) chooseGoal(a);
      return;
    }
    // marche
    head.rotation.x = 0;
    const dx = a.tx - r.position.x, dz = a.tz - r.position.z, d = Math.hypot(dx, dz);
    if (d < 0.15) {
      if (["eat", "drink", "forage"].includes(a.kind)) { a.mode = "peck"; a.t = rnd(2, 4.5); }
      else { a.mode = "idle"; a.t = rnd(0.8, 3); a.kind = "pause"; }
      return;
    }
    const step = Math.min(d, a.speed * dt);
    r.position.x += (dx / d) * step; r.position.z += (dz / d) * step;
    const yaw = Math.atan2(dx, dz);
    let diff = yaw - r.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    r.rotation.y += diff * Math.min(1, dt * 8);
    inner.rotation.z = Math.sin(time * 14 + a.phase) * 0.08;
    inner.position.y = Math.abs(Math.sin(time * 14 + a.phase)) * 0.05;
    // éviter les bâtiments
    for (const o of obstacles()) {
      const ox = r.position.x - o.x, oz = r.position.z - o.z;
      if (Math.abs(ox) < o.hw && Math.abs(oz) < o.hd) {
        if (o.hw - Math.abs(ox) < o.hd - Math.abs(oz)) r.position.x = o.x + Math.sign(ox || 1) * o.hw; else r.position.z = o.z + Math.sign(oz || 1) * o.hd;
      }
    }
    if (a.bubble) a.bubble.position.y = 2.3 + Math.sin(time * 3) * 0.08;
  }

  // ---- placement
  let placement = null; // { kind, moveId, x, z, valid }
  function setGhost(kind, x, z, valid, level = 1) {
    if (ghost) { layers.fx.remove(ghost); ghost = null; }
    ghost = makeBuilding(kind, level);
    ghostify(ghost, valid);
    ghost.position.set(x, 0.05, z);
    layers.fx.add(ghost);
  }
  function showPlacement(info) { placement = info; setGhost(info.kind, info.x, info.z, info.valid, info.level); }
  function clearPlacement() { placement = null; if (ghost) { layers.fx.remove(ghost); ghost = null; } }
  function hideBuilding(id, hidden) { const g = buildingMeshes.get(id); if (g) g.visible = !hidden; }

  // ---- entrées tactiles : glisser = caméra, pincer = zoom, toucher = sélectionner
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function groundAt(clientX, clientY, out = new THREE.Vector3()) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, out);
  }
  function screenOf(obj, yOff = 0.6) {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector3(); obj.getWorldPosition(v); v.y += yOff; v.project(camera);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }
  function pickAt(clientX, clientY) {
    // 1. œufs puis poules : tolérance en pixels (doigts). Un œuf prime sur une poule posée dessus.
    for (const [id, m] of eggMeshes) {
      if (m.userData.popping) continue;
      const p = screenOf(m, 0.2);
      if (Math.hypot(p.x - clientX, p.y - clientY) < 40) return { type: "egg", id };
    }
    let best = null, bestD = 44;
    for (const a of actors.values()) { const p = screenOf(a.root, 0.7 * a.root.scale.x); const d = Math.hypot(p.x - clientX, p.y - clientY); if (d < bestD) { bestD = d; best = { type: "hen", id: a.id }; } }
    if (best) return best;
    // 2. bâtiments
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(layers.buildings.children, true);
    for (const h of hits) if (h.object.userData.type === "building") return h.object.userData;
    const gp = groundAt(clientX, clientY);
    return gp ? { type: "ground", x: gp.x, z: gp.z } : null;
  }

  const pointers = new Map();
  let gesture = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (!active) return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    gesture = { moved: false, multi: pointers.size > 1 || (gesture && gesture.multi) };
    if (pointers.size === 1) { const g = groundAt(e.clientX, e.clientY); gesture.anchor = g ? g.clone() : null; }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture.dist0 = Math.hypot(a.x - b.x, a.y - b.y); gesture.camDist0 = cam.dist; gesture.multi = true; }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId); if (!active || !p || !gesture) return;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_PX) gesture.moved = true;
    if (pointers.size === 1 && gesture.moved && gesture.anchor && !gesture.multi) {
      // "saisir" le sol : le point sous le doigt reste sous le doigt
      placeCamera();
      const g = groundAt(p.x, p.y);
      if (g) {
        cam.x = Math.max(-LIMITS.pan, Math.min(LIMITS.pan, cam.x + gesture.anchor.x - g.x));
        cam.z = Math.max(-LIMITS.pan, Math.min(LIMITS.pan, cam.z + gesture.anchor.z - g.z));
        placeCamera();
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.dist0 > 0) cam.dist = Math.max(LIMITS.min, Math.min(LIMITS.max, gesture.camDist0 * gesture.dist0 / d));
    }
  });
  const end = (e, cancelled) => {
    const p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
    if (!p || !gesture) return;
    const isTap = !cancelled && !gesture.moved && !gesture.multi && performance.now() - p.t < 600;
    if (pointers.size === 0) {
      if (isTap) handleTap(e.clientX, e.clientY);
      gesture = null;
    }
  };
  canvas.addEventListener("pointerup", (e) => end(e, false));
  canvas.addEventListener("pointercancel", (e) => end(e, true));
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = Math.max(LIMITS.min, Math.min(LIMITS.max, cam.dist * (e.deltaY > 0 ? 1.08 : 0.92))); }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function handleTap(x, y) {
    placeCamera();
    const hit = pickAt(x, y);
    if (placement) {
      if (hit?.type === "ground" || hit?.type === "building" || hit?.type === "hen" || hit?.type === "egg") {
        const g = groundAt(x, y);
        if (g) onTap({ type: "place", x: Math.round(g.x), z: Math.round(g.z) });
      }
      return;
    }
    if (hit) onTap(hit);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // en portrait, on éloigne un peu la caméra pour garder le terrain visible
    camera.fov = w / h < 0.8 ? 52 : 42;
    camera.updateProjectionMatrix();
  }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  window.addEventListener("resize", resize);
  resize();

  let last = performance.now(), time = 0, active = true, extra = null;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (active && state) {
      for (const a of actors.values()) updateActor(a, dt, time);
      for (let i = emotes.length - 1; i >= 0; i--) {
        const f = emotes[i]; f.life -= dt;
        if (f.pop) { f.s.scale.setScalar(1 + (0.35 - f.life) * 3); f.s.position.y += dt * 3; if (f.life <= 0) { layers.eggs.remove(f.s); eggMeshes.forEach((m, id) => { if (m === f.s) eggMeshes.delete(id); }); f.then?.(); emotes.splice(i, 1); } continue; }
        f.s.position.y += dt * 0.9; f.s.material.opacity = Math.max(0, f.life);
        if (f.life <= 0) { layers.fx.remove(f.s); emotes.splice(i, 1); }
      }
      for (const m of eggMeshes.values()) m.children[0].position.y = 0.23 + Math.sin(time * 2 + m.position.x) * 0.02;
      placeCamera();
      renderer.render(scene, camera);
    }
    else if (!active && extra) extra(dt, time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    sync, emote, pop, showPlacement, clearPlacement, hideBuilding, resize,
    setActive(v) { active = v; pointers.clear(); gesture = null; },
    setOverlayRenderer(fn) { extra = fn; },
    get cam() { return cam; },
    centerOn(x, z) { cam.x = Math.max(-LIMITS.pan, Math.min(LIMITS.pan, x)); cam.z = Math.max(-LIMITS.pan, Math.min(LIMITS.pan, z)); },
    // utilitaires pour tests automatisés
    screenOfHen(id) { placeCamera(); const a = actors.get(id); return a ? screenOf(a.root, 0.7) : null; },
    screenOfEgg(id) { placeCamera(); const m = eggMeshes.get(id); return m ? screenOf(m, 0.2) : null; },
    screenOfBuilding(id) { placeCamera(); const g = buildingMeshes.get(id); return g ? screenOf(g, 1.0) : null; },
    screenOfGround(x, z) { placeCamera(); const r = canvas.getBoundingClientRect(); const v = new THREE.Vector3(x, 0, z).project(camera); return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height }; },
    renderer,
  };
}
