import * as S from "./sim/index.js";
import { createWorld } from "./game/world.js";
import { createNestView } from "./game/nestview.js";
import { panelContent, recapHtml, esc } from "./game/panels.js";

const $ = (id) => document.getElementById(id);
let state = S.loadGame();
let panel = "", ctx = { selectedHen: "", marketPrice: 0 };
let mode = "farm"; // farm | nests
let placing = null; // { kind, moveId, x, z, level }
let broodMode = false, busy = false;

// ---- utilitaires -------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}
let saveTimer;
function save() { S.saveGame(state); }
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

// ---- 3D ----------------------------------------------------------------------
const canvas = $("canvas");
let world, nest;
try {
  world = createWorld(canvas, { onTap: onWorldTap });
  nest = createNestView(world.renderer, canvas, { onTap: onNestTap });
  world.setOverlayRenderer((dt) => nest.render(dt));
} catch (err) {
  $("boot").innerHTML = "<div>😕<p>La 3D n'est pas disponible sur cet appareil.</p></div>";
  throw err;
}
new ResizeObserver(() => { world.resize(); nest.resize(); }).observe(canvas);

// ---- interface ---------------------------------------------------------------
function hint() {
  const s = state;
  if (placing) return "";
  if (mode === "nests") return "";
  if (!S.hasBuilding(s, "pen")) return "Pour commencer : ouvre la boutique 🛒 et place un enclos.";
  for (const k of ["coop", "feeder", "water"]) if (!S.hasBuilding(s, k)) return `Il manque encore : ${["coop", "feeder", "water"].filter((x) => !S.hasBuilding(s, x)).map((x) => S.BUILDINGS[x].name.toLowerCase()).join(", ")}.`;
  if (S.henHomeProblem(s)) return "Déplace le poulailler, la mangeoire et l'abreuvoir à l'intérieur de l'enclos.";
  if (!s.hens.length) return "Ta ferme est prête : adopte tes premières poules 🐔";
  if (s.feederStock < s.hens.length || s.waterStock < s.hens.length) return "La mangeoire ou l'abreuvoir sont presque vides : onglet Ferme 🌾";
  if (S.isMarketDay(s) && s.market.doneDay !== s.day) return "C'est dimanche : le marché t'attend 🧺";
  const eggs = S.eggsInNests(s).length + S.eggsOnGrass(s).length;
  if (s.recap && s.recap.newDay === s.day && eggs) return "Touche le poulailler pour découvrir les œufs du matin ✨";
  return "Passe la nuit quand tu es prêt·e.";
}
function refresh() {
  const s = state;
  S.recharge(s);
  $("dayChip").textContent = `${S.dayName(s)} · J${s.day}`;
  $("coinChip").textContent = `🪙 ${s.coins}`;
  $("energyChip").textContent = `⚡ ${s.energy}/${S.MAX_ENERGY}`;
  $("energyChip").classList.toggle("low", s.energy === 0);
  const sleep = $("sleepBtn");
  sleep.disabled = s.energy < 1;
  $("sleepLabel").textContent = s.energy < 1 ? `⚡ dans ${S.formatCountdown(S.msUntilEnergy(s))}` : "Passer la nuit";
  const h = hint();
  $("hint").innerHTML = h ? `<span>${esc(h)}</span>` : "";

  const needs = s.hens.length && (s.feederStock < s.hens.length || s.waterStock < s.hens.length);
  const flags = { shop: false, hens: s.hens.some((x) => x.sick), farm: !!needs, market: S.isMarketDay(s) && s.market.doneDay !== s.day };
  document.querySelectorAll(".tab[data-panel]").forEach((t) => t.querySelector(".dot").classList.toggle("hidden", !flags[t.dataset.panel]));
}
function renderPanel() {
  if (!panel) return;
  const { title, html } = panelContent(panel, state, ctx);
  const sheet = $("sheet");
  const scroll = sheet.querySelector(".sheet-body")?.scrollTop || 0;
  sheet.innerHTML = `<div class="sheet-head"><h2>${title}</h2><button class="x" data-act="close" aria-label="Fermer">✕</button></div><div class="sheet-body">${html}</div>`;
  sheet.querySelector(".sheet-body").scrollTop = scroll;
  sheet.classList.remove("hidden");
  document.querySelectorAll(".tab[data-panel]").forEach((t) => t.classList.toggle("active", t.dataset.panel === (panel === "hen" ? "hens" : panel)));
}
function openPanel(name, extra = {}) { Object.assign(ctx, extra); panel = name; renderPanel(); }
function closePanel() { panel = ""; $("sheet").classList.add("hidden"); }

// Applique le résultat d'une action de la simulation.
function commit(result, { silent = false } = {}) {
  if (result && !result.ok) { toast(result.msg); return false; }
  if (result && result.msg && !silent) toast(result.msg);
  save();
  world.sync(state);
  if (mode === "nests") nest.sync(state);
  refresh();
  const editing = document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && $("sheet").contains(document.activeElement);
  if (!editing) renderPanel();
  return true;
}

// ---- construction ------------------------------------------------------------
function suggestSpot(kind, moveId) {
  const pen = S.building(state, "pen");
  const cx = kind !== "pen" && pen ? pen.x : Math.round(world.cam.x), cz = kind !== "pen" && pen ? pen.z : Math.round(world.cam.z);
  for (let r = 0; r <= 14; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    if (!S.placementProblem(state, kind, cx + dx, cz + dz, moveId)) return { x: cx + dx, z: cz + dz };
  }
  return { x: cx, z: cz };
}
function startPlacement(kind, moveId = null) {
  const spot = suggestSpot(kind, moveId);
  placing = { kind, moveId, ...spot };
  closePanel();
  if (moveId) world.hideBuilding(moveId, true);
  world.centerOn(spot.x, spot.z);
  updatePlacement();
  $("placebar").classList.remove("hidden"); $("dock").classList.add("hidden");
  refresh();
}
function updatePlacement() {
  const p = placing, problem = S.placementProblem(state, p.kind, p.x, p.z, p.moveId);
  p.valid = !problem;
  world.showPlacement({ kind: p.kind, x: p.x, z: p.z, valid: p.valid, level: 1 });
  const def = S.BUILDINGS[p.kind];
  $("placeMsg").textContent = problem || (p.moveId ? `${def.name} : emplacement valide.` : `${def.name} · ${def.levels[0].price} 🪙 — touche le terrain pour le déplacer`);
  $("placeOk").disabled = !p.valid;
}
function endPlacement() {
  if (placing?.moveId) world.hideBuilding(placing.moveId, false);
  placing = null; world.clearPlacement();
  $("placebar").classList.add("hidden"); $("dock").classList.remove("hidden");
  refresh();
}

// ---- toucher dans le monde ---------------------------------------------------
function onWorldTap(hit) {
  if (busy) return;
  if (hit.type === "place" && placing) { placing.x = hit.x; placing.z = hit.z; updatePlacement(); return; }
  if (hit.type === "hen") { openPanel("hen", { selectedHen: hit.id }); return; }
  if (hit.type === "egg") {
    const r = S.collectEgg(state, hit.id);
    if (!r.ok) return commit(r);
    world.pop(hit.id, () => {});
    toast("Un œuf caché ! 🥚");
    commit(r, { silent: true });
    return;
  }
  if (hit.type === "building") {
    const b = state.buildings.find((v) => v.id === hit.id);
    if (b?.kind === "coop") openNests();
    else openPanel("farm");
    return;
  }
  closePanel();
}

// ---- vue des nids ------------------------------------------------------------
function openNests() {
  if (!S.hasBuilding(state, "coop")) return toast("Il faut un poulailler.");
  closePanel();
  mode = "nests"; broodMode = false;
  world.setActive(false); nest.setActive(true); nest.sync(state);
  $("dock").classList.add("hidden"); $("nestbar").classList.remove("hidden"); $("nesttop").classList.remove("hidden");
  updateNestUI(); refresh();
}
function closeNests() {
  mode = "farm"; nest.setActive(false); world.setActive(true);
  $("nestbar").classList.add("hidden"); $("nesttop").classList.add("hidden"); $("dock").classList.remove("hidden");
  world.sync(state); refresh();
}
function updateNestUI() {
  const e = S.eggsInNests(state).length;
  $("nesttop").textContent = `Poulailler · propreté ${Math.round(state.cleanliness)}%`;
  $("nestMsg").textContent = broodMode ? "Mode couvaison : touche un œuf pour le marquer ou le démarquer." : e ? "Touche chaque œuf pour le ramasser." : "Les nids sont vides.";
  $("nestBrood").classList.toggle("on", broodMode);
  $("nestClean").disabled = state.cleanedDay === state.day;
}
function onNestTap(hit) {
  if (busy) return;
  if (broodMode) { const r = S.toggleBrood(state, hit.id); if (commit(r)) updateNestUI(); return; }
  if (hit.status === "brood") return toast("Cet œuf est réservé à la couvaison. Active le mode couvaison pour le démarquer.");
  const r = S.collectEgg(state, hit.id);
  if (!r.ok) return commit(r);
  busy = true;
  nest.pop(hit.id, () => { busy = false; commit(r, { silent: true }); updateNestUI(); });
  toast("Œuf récolté ! (" + S.storedEggs(state) + " en stock)");
}

// ---- actions de l'interface --------------------------------------------------
const actions = {
  close: () => closePanel(),
  "panel-hens": () => openPanel("hens"),
  "place": (b) => startPlacement(b.dataset.kind),
  "move": (b) => startPlacement(state.buildings.find((v) => v.id === b.dataset.id).kind, b.dataset.id),
  "place-cancel": () => endPlacement(),
  "place-ok": () => {
    const p = placing; if (!p || !p.valid) return;
    const r = p.moveId ? S.moveBuilding(state, p.moveId, p.x, p.z) : S.buyBuilding(state, p.kind, p.x, p.z);
    if (!r.ok) return toast(r.msg);
    endPlacement(); commit(r); openPanel("shop");
  },
  upgrade: (b) => commit(S.upgradeBuilding(state, b.dataset.kind)),
  "buy-hen": (b) => { const r = S.buyHen(state, b.dataset.kind); if (commit(r)) { const hen = r.hen; ctx.selectedHen = hen.id; } },
  "buy-feed": () => commit(S.buyFeed(state)),
  "fill-feeder": () => commit(S.fillFeeder(state)),
  "fill-water": () => commit(S.fillWater(state)),
  "clean-coop": () => commit(S.cleanCoop(state)),
  "open-hen": (b) => openPanel("hen", { selectedHen: b.dataset.id }),
  pet: (b) => { const r = S.petHen(state, b.dataset.id); if (commit(r)) world.emote(b.dataset.id); },
  care: (b) => commit(S.careHen(state, b.dataset.id)),
  euthanize: (b) => {
    const h = S.findHen(state, b.dataset.id);
    if (h && confirm(`Dire adieu à ${h.name} ? Cette décision est définitive.`)) { const r = S.euthanize(state, b.dataset.id); if (commit(r)) openPanel("hens"); }
  },
  "toggle-mortality": () => { state.settings.mortality = !state.settings.mortality; commit({ ok: true, msg: state.settings.mortality ? "Les poules très âgées peuvent désormais s'éteindre." : "Plus aucune mort naturelle." }); },
  reset: () => { if (confirm("Effacer cette ferme et recommencer à zéro ?")) { state = S.resetGame(); closePanel(); world.sync(state); save(); refresh(); } },
  "market-open": () => { const r = S.openMarket(state, ctx.marketPrice || S.referencePrice(state)); commit(r, { silent: true }); },
  "sale-accept": () => commit(S.marketDecision(state, "accept")),
  "sale-counter": () => commit(S.marketDecision(state, "counter")),
  "sale-skip": () => commit(S.marketDecision(state, "skip")),
  "market-close": () => commit(S.closeMarket(state)),
  "nest-back": () => closeNests(),
  "nest-clean": () => { if (commit(S.cleanCoop(state))) updateNestUI(); },
  "nest-brood": () => { broodMode = !broodMode; updateNestUI(); },
  "recap-nests": () => { closeModal(); openNests(); },
  "recap-ok": () => closeModal(),
  sleep: () => sleep(),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act],[data-panel]");
  if (!b || b.disabled) return;
  if (b.dataset.panel) { if (placing || mode !== "farm") return; panel === b.dataset.panel ? closePanel() : openPanel(b.dataset.panel); return; }
  actions[b.dataset.act]?.(b);
});
$("sheet").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.input === "notes") { const h = S.findHen(state, ctx.selectedHen); if (h) { S.setNotes(state, h.id, t.value); saveSoon(); } }
  if (t.dataset.input === "price") {
    ctx.marketPrice = Number(t.value);
    const ref = S.referencePrice(state), d = S.demandFactor(ctx.marketPrice, ref);
    $("priceVal").textContent = `${ctx.marketPrice} 🪙`;
    $("priceDemand").textContent = `Référence : ${ref} 🪙 · ` + (d > 1.05 ? "Foule nombreuse" : d > 0.75 ? "Bonne affluence" : d > 0.4 ? "Affluence moyenne" : "Très peu de passants");
  }
});
$("sheet").addEventListener("change", (e) => {
  if (e.target.dataset.input === "name") {
    const r = S.renameHen(state, ctx.selectedHen, e.target.value);
    if (!r.ok) { toast(r.msg); e.target.value = S.findHen(state, ctx.selectedHen)?.name || ""; return; }
    save(); renderPanel();
  }
});

// ---- nuit & récapitulatif ----------------------------------------------------
function closeModal() { $("modal").classList.add("hidden"); $("modal").innerHTML = ""; refresh(); }
function showRecap() {
  const s = state, r = s.recap; if (!r) return;
  const coop = S.hasBuilding(s, "coop");
  $("modal").innerHTML = `<div class="modal-card"><h2>☀️ ${esc(r.newWeekday)}, jour ${r.newDay}</h2><div class="sheet-body">${recapHtml(s)}` +
    `<p class="highlight"><b>${coop ? "Que trouveras-tu dans les nids ce matin ?" : "Une nouvelle journée commence."}</b></p></div>` +
    `<div class="foot">${coop ? '<button class="btn primary" data-act="recap-nests">🥚 Ouvrir le poulailler</button>' : '<button class="btn primary" data-act="recap-ok">Commencer la journée</button>'}` +
    (coop ? '<div style="height:8px"></div><button class="btn ghost" data-act="recap-ok">Plus tard</button>' : "") + "</div></div>";
  $("modal").classList.remove("hidden");
}
function sleep() {
  if (busy || placing || mode !== "farm") return;
  if (state.energy < 1) return toast("Plus d'énergie : patiente un peu ⚡");
  busy = true; closePanel(); ctx.marketPrice = 0;
  $("fade").classList.remove("hidden");
  setTimeout(() => {
    const r = S.sleepDay(state);
    save(); world.sync(state); refresh();
    setTimeout(() => {
      $("fade").classList.add("hidden"); busy = false;
      if (r.ok) showRecap(); else toast(r.msg);
    }, 600);
  }, 700);
}

// ---- cycle de vie ------------------------------------------------------------
setInterval(() => {
  const before = state.energy;
  refresh();
  if (before !== state.energy) save();
  const c = document.getElementById("energyCount"); if (c) c.textContent = S.formatCountdown(S.msUntilEnergy(state));
}, 1000);
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); else { S.recharge(state); refresh(); } });
window.addEventListener("pagehide", save);
// empêche le zoom par pincement / double-tap de Safari sur l'interface
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

world.sync(state);
refresh();
if (!state.buildings.length) openPanel("shop");
requestAnimationFrame(() => $("boot").classList.add("gone"));

// Accès de débogage / tests automatisés
window.__cosy = { get state() { return state; }, world, nest, S, openNests, closeNests };
