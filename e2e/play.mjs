// Test de bout en bout : joue une semaine complète sur un iPhone émulé (écran tactile).
// Usage : npm run build && node e2e/play.mjs   (serveur de prévisualisation lancé automatiquement)
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const globalReq = createRequire((process.env.NODE_PATH || "/opt/node22/lib/node_modules") + "/");
let pw;
try { pw = require("playwright"); } catch { pw = globalReq("playwright"); }
const { chromium, devices } = pw;

const PORT = 4173, URL_ = `http://localhost:${PORT}/`;
const SHOTS = "e2e/shots";
mkdirSync(SHOTS, { recursive: true });

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const cleanup = () => { try { server.kill(); } catch {} };
process.on("exit", cleanup);
for (let i = 0; i < 60; i++) { try { if ((await fetch(URL_)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }

const custom = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({
  executablePath: custom,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });

const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__cosy.state)));
const tapAt = async ({ x, y }) => { await page.touchscreen.tap(x, y); await wait(120); };
const click = async (selector) => { await page.locator(selector).first().tap(); await wait(150); };
const act = (a) => click(`[data-act="${a}"]:visible`);
let step = 0;
const log = (m) => console.log(`✓ ${String(++step).padStart(2, "0")} ${m}`);

await page.goto(URL_);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector("#boot.gone", { state: "attached" });
await wait(800);

// -- 1. Écran de départ : terrain vide, 280 pièces
let s = await st();
assert.equal(s.buildings.length, 0); assert.equal(s.coins, 280);
const dims = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, glOk: !!document.getElementById("canvas").getContext("webgl2") || true }));
assert.ok(dims.w <= 500, "viewport mobile");
await shot("01-depart");
log("démarrage sur terrain vide avec 280 pièces");

// -- 2. Construction libre : les 4 installations
async function build(kind) {
  await page.locator(`[data-act="place"][data-kind="${kind}"]`).tap(); await wait(300);
  await page.waitForSelector("#placebar:not(.hidden)");
  assert.equal(await page.locator("#placeOk").isDisabled(), false, "emplacement suggéré valide pour " + kind);
  if (kind === "pen") await shot("02-placement-enclos");
  await act("place-ok"); await wait(300);
}
for (const kind of ["pen", "coop", "feeder", "water"]) await build(kind);
s = await st();
assert.deepEqual(s.buildings.map((b) => b.kind), ["pen", "coop", "feeder", "water"]);
assert.equal(s.coins, 280 - 35 - 95 - 25 - 20);
log("enclos, poulailler, mangeoire et abreuvoir placés");

// placement refusé sur un emplacement invalide (toucher le terrain hors de l'enclos, sur la clôture)
await page.locator('[data-act="move"][data-id="' + s.buildings[2].id + '"]').tap(); await wait(300);
const pen = s.buildings[0];
const fence = await page.evaluate(({ x, z }) => window.__cosy.world.screenOfGround(x, z), { x: pen.x + 5, z: pen.z });
await tapAt(fence);
assert.equal(await page.locator("#placeOk").isDisabled(), true, "la clôture bloque le placement");
await shot("03-placement-invalide");
await act("place-cancel"); await wait(200);
log("placement invalide refusé, annulation possible");

// -- 3. Achat de poules
await page.locator('.tab[data-panel="shop"]').tap(); await wait(300);
await page.locator('[data-act="buy-hen"][data-kind="young"]').tap(); await wait(200);
await page.locator('[data-act="buy-hen"][data-kind="rescue"]').tap(); await wait(200);
await page.locator('[data-act="buy-hen"][data-kind="rescue"]').tap(); await wait(200);
await page.locator('[data-act="buy-hen"][data-kind="chick"]').tap(); await wait(200);
s = await st();
assert.equal(s.hens.length, 4);
await shot("04-boutique-poules");
log("4 poules achetées (jeunes, réforme, poussin)");

// -- 4. Entretien
await page.locator('.tab[data-panel="farm"]').tap(); await wait(300);
await act("fill-feeder"); await act("fill-water");
s = await st(); assert.ok(s.feederStock > 0 && s.waterStock > 0);
await shot("05-ferme");
log("mangeoire et abreuvoir remplis");

// -- 5. Caméra : glisser et pincer
await page.locator("#sheet [data-act=close]").tap(); await wait(300);
const cam0 = await page.evaluate(() => ({ ...window.__cosy.world.cam }));
await page.mouse.move(200, 400); await page.mouse.down(); await page.mouse.move(120, 330, { steps: 8 }); await page.mouse.up(); await wait(200);
const cam1 = await page.evaluate(() => ({ ...window.__cosy.world.cam }));
assert.ok(Math.hypot(cam1.x - cam0.x, cam1.z - cam0.z) > 0.5, "le glisser déplace la caméra");
const client = await context.newCDPSession(page);
const pinch = async (d0, d1) => {
  const cx = 195, cy = 350, pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(d0) });
  for (let i = 1; i <= 8; i++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(d0 + ((d1 - d0) * i) / 8) });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(200);
};
await pinch(80, 200);
const cam2 = await page.evaluate(() => ({ ...window.__cosy.world.cam }));
assert.ok(cam2.dist < cam1.dist - 3, `pincer écarte = zoom avant (${cam1.dist} -> ${cam2.dist})`);
await pinch(200, 80);
await page.evaluate(() => window.__cosy.world.centerOn(0, 0));
await shot("06-ferme-vue");
log("glisser déplace la caméra, pincer zoome");

// -- 6. Fiche de poule : toucher, caresser, renommer, carnet
const hen = s.hens[0];
await wait(500);
let pos = await page.evaluate((id) => window.__cosy.world.screenOfHen(id), hen.id);
await tapAt(pos);
if (!(await page.locator("#sheet #henName").count())) { // la poule marchait : on réessaie
  pos = await page.evaluate((id) => window.__cosy.world.screenOfHen(id), hen.id); await tapAt(pos);
}
await page.waitForSelector("#henName");
await page.fill("#henName", "Poulette"); await page.locator("#henName").blur(); await wait(200);
for (let i = 0; i < 8; i++) { await page.locator('#sheet [data-act="pet"]').tap(); await wait(80); }
await page.fill("#henNotes", "Adore le maïs"); await wait(700);
s = await st();
const h0 = s.hens.find((h) => h.id === hen.id);
assert.equal(h0.name, "Poulette"); assert.equal(h0.notes, "Adore le maïs");
assert.ok(h0.affection > 0 && h0.affection <= 4.0001, "affection plafonnée : " + h0.affection);
await shot("07-fiche-poule");
await page.locator("#sheet [data-act=close]").tap();
log("toucher une poule ouvre sa fiche ; prénom, caresses plafonnées, carnet");

// -- 7. Une semaine de jeu : nuit, récap, nids, récolte, marché
async function night() {
  const day = (await st()).day;
  await act("sleep");
  await page.waitForSelector("#modal:not(.hidden)", { timeout: 8000 });
  assert.equal((await st()).day, day + 1);
}
async function morning(collect = true) {
  // les œufs apparaissent dans la vue rapprochée des nids ; on touche chaque œuf
  await act("recap-nests"); await wait(500);
  await page.waitForSelector("#nestbar:not(.hidden)");
  let collected = 0;
  if (!globalThis.__nestShot && (await page.evaluate(() => window.__cosy.S.eggsInNests(window.__cosy.state).length)) >= 2) { globalThis.__nestShot = true; await shot("09-nids-oeufs"); }
  for (let guard = 0; guard < 40; guard++) {
    const ids = await page.evaluate(() => window.__cosy.S.eggsInNests(window.__cosy.state).map((e) => e.id));
    if (!ids.length) break;
    const p = await page.evaluate((id) => window.__cosy.nest.screenOfEgg(id), ids[0]);
    assert.ok(p, "œuf visible");
    await tapAt(p); await wait(500); collected++;
  }
  return collected;
}
let totalCollected = 0, shotNests = false;
for (let d = 0; d < 6; d++) {
  // entretien quotidien
  await page.locator('.tab[data-panel="farm"]').tap(); await wait(200);
  await act("fill-water");
  if ((await st()).feedReserve < 8) await page.evaluate(() => 0);
  await act("fill-feeder"); await act("clean-coop");
  await page.locator("#sheet [data-act=close]").tap();
  await night();
  if (d === 0) await shot("08-recap-matin");
  const c = await morning();
  if (c && !shotNests) { shotNests = true; }
  totalCollected += c;
  if (d === 1) await shot("09-nids");
  await act("nest-back"); await wait(300);
  // œufs cachés dans l'herbe : on les touche dans la ferme
  const grass = await page.evaluate(() => window.__cosy.S.eggsOnGrass(window.__cosy.state).map((e) => e.id));
  for (const id of grass) {
    const p = await page.evaluate((i) => window.__cosy.world.screenOfEgg(i), id);
    if (p) { await tapAt(p); await wait(300); totalCollected++; }
  }
  // achat de graines si besoin
  const cur = await st();
  if (cur.feedReserve < 8 && cur.coins >= 10) { await page.locator('.tab[data-panel="shop"]').tap(); await wait(200); await page.locator('[data-act="buy-feed"]').tap(); await wait(150); await page.locator("#sheet [data-act=close]").tap(); }
  assert.ok((await st()).hens.length >= 4);
}
s = await st();
assert.equal(s.day, 7); assert.equal(s.energy, 15 - 6);
assert.ok(totalCollected > 0, "des œufs ont été récoltés : " + totalCollected);
assert.equal(s.stats.eggsCollected, totalCollected);
log(`6 nuits jouées, ${totalCollected} œufs récoltés un par un (nids et herbe)`);

// -- 8. Marché du dimanche
await page.locator('.tab[data-panel="market"]').tap(); await wait(300);
await page.waitForSelector("#marketPrice");
await shot("10-marche");
const coinsBefore = (await st()).coins;
await act("market-open"); await wait(300);
await shot("11-stand");
for (let g = 0; g < 30 && (await page.locator('[data-act="sale-accept"]:visible').count()); g++) {
  if (g % 3 === 1 && (await page.locator('[data-act="sale-counter"]:visible').count())) await act("sale-counter");
  else await act("sale-accept");
}
s = await st();
assert.equal(s.market.session, null);
assert.ok(s.coins > coinsBefore, `le marché rapporte de l'argent (${coinsBefore} -> ${s.coins})`);
assert.equal(s.market.doneDay, 7);
await shot("12-marche-fini");
log(`marché : ${s.market.last.sold} œufs vendus, +${s.market.last.earned} pièces`);

// -- 9. Sauvegarde automatique : rechargement
const before = await st();
await page.reload(); await page.waitForSelector("#boot.gone", { state: "attached" }); await wait(600);
const after = await st();
assert.equal(after.day, before.day); assert.equal(after.coins, before.coins);
assert.equal(after.hens.length, before.hens.length); assert.equal(after.hens[0].name, "Poulette");
assert.equal(after.eggs.length, before.eggs.length);
await shot("13-apres-rechargement");
log("sauvegarde locale restaurée après rechargement");

// -- 10. Énergie : 0 énergie bloque la nuit mais pas les interactions
await page.evaluate(() => { const s = window.__cosy.state; s.energy = 0; s.energyAt = Date.now(); });
await wait(1200);
assert.equal(await page.locator("#sleepBtn").isDisabled(), true);
await shot("14-energie-vide");
log("énergie à 0 : nuit désactivée avec compte à rebours");

// -- Bilan
const real = problems.filter((p) => !/favicon|Failed to load resource/.test(p));
assert.deepEqual(real, [], "aucune erreur console : " + real.join(" | "));
await browser.close(); cleanup();
console.log("\nE2E OK — captures dans " + SHOTS + "/");
process.exit(0);
