// Vue rapprochée des nids : on touche les œufs un par un pour les ramasser.
import * as THREE from "three";
import { mat, makeEgg, hashStr } from "./models.js";
import { coopNests } from "../sim/state.js";

const CELL_W = 3.3, CELL_H = 2.7;
const STRAW_CLEAN = new THREE.Color(0xe9c96b), STRAW_DIRTY = new THREE.Color(0x7d5c3a);

export function createNestView(renderer, canvas, { onTap }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7cf9f);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0xb89865, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(-3, 6, 8); scene.add(sun);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshLambertMaterial({ color: 0xcfa970 }));
  wall.position.z = -0.6; scene.add(wall);
  for (let i = -12; i <= 12; i++) { // planches
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 40, 0.05), mat(0xb88f58)); b.position.set(i * 1.6, 0, -0.55); scene.add(b);
  }
  const content = new THREE.Group(); scene.add(content);
  const eggMeshes = new Map();
  const straws = [];
  let state = null, active = false, cols = 2, rows = 2;

  function layout(aspect) {
    const n = state ? Math.max(1, coopNests(state)) : 3;
    cols = aspect < 0.85 ? 2 : aspect < 1.3 ? 3 : 4;
    cols = Math.min(cols, n);
    rows = Math.ceil(n / cols);
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const dist = Math.max((rows * CELL_H * 1.2) / (2 * t), (cols * CELL_W * 1.15) / (2 * t * aspect));
    camera.position.set(0, -0.15, Math.max(7, dist)); camera.lookAt(0, -0.15, 0);
    camera.updateMatrixWorld();
  }
  function nestPos(i) {
    const c = i % cols, r = Math.floor(i / cols);
    const rowCount = Math.min(cols, coopNests(state) - r * cols);
    return { x: (c - (rowCount - 1) / 2) * CELL_W, y: ((rows - 1) / 2 - r) * CELL_H };
  }

  function sync(s) {
    state = s;
    content.clear(); eggMeshes.clear(); straws.length = 0;
    const n = coopNests(s);
    const dirt = 1 - Math.max(0, Math.min(1, s.cleanliness / 100));
    const strawColor = STRAW_CLEAN.clone().lerp(STRAW_DIRTY, dirt);
    resize();
    for (let i = 0; i < n; i++) {
      const p = nestPos(i);
      const g = new THREE.Group(); g.position.set(p.x, p.y, 0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 1.3), mat(0x9a6a3e)); box.position.y = -0.55; g.add(box);
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.1, 0.42, 14), new THREE.MeshLambertMaterial({ color: strawColor, flatShading: true }));
      straw.scale.z = 0.7; straw.position.y = -0.2; g.add(straw);
      for (let k = 0; k < 9; k++) { // brins de paille décoratifs
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: strawColor }));
        b.position.set(((hashStr("s" + i + k) % 100) / 100 - 0.5) * 2.1, 0.03, ((hashStr("t" + i + k) % 100) / 100 - 0.4) * 0.7);
        b.rotation.z = ((hashStr("r" + i + k) % 100) / 100 - 0.5) * 0.8; g.add(b);
      }
      content.add(g);
      const eggs = s.eggs.filter((e) => e.nest === i && (e.status === "nest" || e.status === "brood"));
      const slots = [[-0.55, 0.1], [0.55, 0.1], [0, -0.15]];
      eggs.slice(0, 3).forEach((e, k) => {
        const m = makeEgg(e.status === "brood" ? 0xf5cf7a : 0xfff3dc);
        m.scale.setScalar(1.6); m.position.set(p.x + slots[k][0], p.y + 0.05 + slots[k][1] * 0.2, 0.35 - slots[k][1] * 0.4);
        m.rotation.z = (k - 1) * 0.35;
        if (e.status === "brood") {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 18), new THREE.MeshBasicMaterial({ color: 0xf3a63d }));
          ring.position.y = 0.3; ring.rotation.x = Math.PI / 2; m.add(ring);
        }
        m.userData = { type: "nestEgg", id: e.id, status: e.status };
        content.add(m); eggMeshes.set(e.id, m);
      });
    }
  }
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    layout(w / h);
  }
  function screenOfEgg(id) {
    const m = eggMeshes.get(id); if (!m) return null;
    camera.updateMatrixWorld();
    const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(); m.getWorldPosition(v); v.y += 0.4; v.project(camera);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }
  function pickEgg(x, y) {
    let best = null, bestD = 52;
    for (const [id, m] of eggMeshes) {
      const p = screenOfEgg(id); const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = m.userData; }
    }
    return best;
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { if (active) down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!active || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12; down = null;
    if (moved) return;
    const hit = pickEgg(e.clientX, e.clientY);
    if (hit) onTap(hit);
  });
  const pops = [];
  function pop(id, then) {
    const m = eggMeshes.get(id); if (!m) return then?.();
    eggMeshes.delete(id); pops.push({ m, life: 0.3, then });
  }
  function render(dt) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.life -= dt; p.m.scale.multiplyScalar(1 + dt * 4); p.m.position.y += dt * 2.5; p.m.position.z += dt * 2;
      if (p.life <= 0) { content.remove(p.m); pops.splice(i, 1); p.then?.(); }
    }
    renderer.render(scene, camera);
  }
  return {
    sync, resize, render, screenOfEgg, pop,
    setActive(v) { active = v; if (v) resize(); },
  };
}
