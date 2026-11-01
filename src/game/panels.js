// Contenu HTML des panneaux (fonctions pures : état -> texte).
import * as S from "../sim/index.js";

const { BUILDINGS, ANIMALS, TRAITS, FEED_BAG, FEEDER_CAPACITY, WATER_CAPACITY, CARE_PRICE, PET_CAP } = S;

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const btn = (label, act, cls = "", attrs = "") => `<button class="btn ${cls}" data-act="${act}" ${attrs}>${label}</button>`;
const card = (inner) => `<div class="card">${inner}</div>`;
const coins = (n) => `${n} 🪙`;
const meter = (label, v, kind = "") => {
  const cls = kind || (v < 25 ? "bad" : v < 50 ? "warn" : "");
  return `<div class="meter"><span>${label}</span><div class="bar2"><i class="${cls}" style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b></div>`;
};
// pour le stress, une valeur basse est bonne
const stressMeter = (v) => meter("Stress", v, v > 75 ? "bad" : v > 50 ? "warn" : "good");

function shop(s) {
  let h = "<h3>Construire</h3>";
  for (const kind of ["pen", "coop", "feeder", "water"]) {
    const def = BUILDINGS[kind], b = S.building(s, kind), price = def.levels[0].price;
    h += card(`<div class="line"><div><b>${def.name}</b><br><small>${def.desc}</small></div>` +
      (b ? `<div>${btn("Déplacer", "move", "small", `data-id="${b.id}" ${kind === "pen" ? "disabled" : ""}`)}</div>`
         : btn(coins(price), "place", "primary small", `data-kind="${kind}" ${s.coins < price ? "disabled" : ""}`)) + "</div>");
  }
  h += "<h3>Agrandir</h3>";
  for (const kind of ["pen", "coop"]) {
    const b = S.building(s, kind); if (!b) continue;
    const price = S.upgradePrice(s, kind), def = BUILDINGS[kind];
    const cur = def.levels[b.level - 1];
    h += card(`<div class="line"><div><b>${def.name} · niveau ${b.level}/${def.levels.length}</b><br><small>${kind === "pen" ? `Accueille ${cur.cap} poules à l'aise` : `${cur.cap} poules · ${cur.nests} nids`}</small></div>` +
      (price == null ? '<span class="tag">Maximum</span>' : btn(coins(price), "upgrade", "warm small", `data-kind="${kind}" ${s.coins < price ? "disabled" : ""}`)) + "</div>");
  }
  const problem = S.henHomeProblem(s);
  h += "<h3>Adopter une poule</h3>";
  if (problem) h += `<p class="muted">${esc(problem)}</p>`;
  for (const [kind, a] of Object.entries(ANIMALS)) {
    h += card(`<div class="line"><div><b>${a.name}</b><br><small>${a.desc}</small></div>` +
      btn(coins(a.price), "buy-hen", "primary small", `data-kind="${kind}" ${s.coins < a.price || problem ? "disabled" : ""}`) + "</div>");
  }
  const cap = S.capacity(s);
  if (cap) h += `<p class="muted">Capacité de la ferme : ${s.hens.length}/${cap} poules. Au-delà, stress, maladies et œufs perdus dans l'herbe.</p>`;
  h += "<h3>Provisions</h3>" + card(`<div class="line"><div><b>Sac de graines</b><br><small>${FEED_BAG.rations} rations · réserve : ${s.feedReserve}</small></div>` +
    btn(coins(FEED_BAG.price), "buy-feed", "primary small", s.coins < FEED_BAG.price ? "disabled" : "") + "</div>");
  return { title: "Boutique", html: h };
}

function hensList(s) {
  if (!s.hens.length) return { title: "Mes poules", html: "<p>Aucune poule pour l'instant. Installe l'enclos, le poulailler, la mangeoire et l'abreuvoir, puis adopte ta première pensionnaire dans la boutique.</p>" };
  let h = `<p class="muted">${s.hens.length} poule(s). Touche une poule dans la ferme pour ouvrir sa fiche.</p>`;
  for (const hen of s.hens) {
    const t = [];
    if (hen.sick) t.push('<span class="tag bad">Malade</span>');
    if (hen.satiety < 40) t.push('<span class="tag warm">Faim</span>');
    if (hen.hydration < 40) t.push('<span class="tag warm">Soif</span>');
    h += card(`<div class="line"><div><b>${esc(hen.name)}</b> <span class="tag">${TRAITS[hen.trait].label}</span> ${t.join(" ")}<br><small>${S.STAGE_LABEL[S.stageOf(hen)]} · ${hen.age} jours</small></div>` +
      btn("Fiche", "open-hen", "small", `data-id="${hen.id}"`) + "</div>");
  }
  return { title: "Mes poules", html: h };
}

function henSheet(s, ctx) {
  const h = S.findHen(s, ctx.selectedHen);
  if (!h) return hensList(s);
  const left = Math.max(0, PET_CAP.affection - h.today.affection);
  let html = `<p><span class="tag">${TRAITS[h.trait].label}</span> <span class="tag">${S.STAGE_LABEL[S.stageOf(h)]}</span> ${h.sick ? `<span class="tag bad">Malade : ${esc(h.symptom)}</span>` : ""}</p>`;
  html += card(`<label for="henName">Prénom</label><input type="text" id="henName" maxlength="24" value="${esc(h.name)}" data-input="name" autocomplete="off" />` +
    `<p class="muted">${h.age} jours · arrivée au jour ${h.arrivedDay} · ${h.eggsLaid} œuf(s) pondu(s)</p>`);
  html += card("<b>Besoins</b>" + meter("Satiété", h.satiety) + meter("Hydratation", h.hydration) + meter("Santé", h.health) +
    meter("Bonheur", h.happiness) + meter("Propreté", h.cleanliness) + meter("Sociabilité", h.social) + stressMeter(h.stress));
  html += card("<b>Lien avec toi</b>" + meter("Confiance", h.trust, "trust") + meter("Affection", h.affection, "love") +
    `<p class="muted">${left > 0.05 ? "Elle a encore envie de câlins aujourd'hui." : "Elle a eu sa dose d'affection pour aujourd'hui (plafond quotidien)."}</p>` +
    `<p class="muted">Soins : ${CARE_PRICE} 🪙</p>` + '<div class="row">' + btn("🤚 Caresser", "pet", "primary", `data-id="${h.id}"`) + btn("💊 Soigner", "care", "warm", `data-id="${h.id}" ${h.sick ? "" : "disabled"}`) + "</div>");
  html += card(`<b>Son histoire</b>` + (h.history.length ? "<p>" + h.history.slice(0, 6).map((v) => `<small>Jour ${v.day}</small> · ${esc(v.text)}`).join("<br>") + "</p>" : "") +
    `<label for="henNotes">Carnet de notes</label><textarea id="henNotes" data-input="notes" placeholder="Ses habitudes, ses petites manies…">${esc(h.notes)}</textarea>`);
  if (S.canEuthanize(h)) {
    html += card(`<b>Situation grave</b><p class="muted">${esc(h.name)} souffre depuis plusieurs jours. Tu peux encore la soigner, ou prendre la décision de lui dire adieu.</p>` +
      btn("Lui dire adieu…", "euthanize", "danger", `data-id="${h.id}"`));
  }
  html += `<div style="height:6px"></div>${btn("← Toutes les poules", "panel-hens", "ghost")}`;
  return { title: esc(h.name), html };
}

function farm(s) {
  const hasFeeder = S.hasBuilding(s, "feeder"), hasWater = S.hasBuilding(s, "water"), hasCoop = S.hasBuilding(s, "coop");
  let h = card(`<b>Soins quotidiens</b>` +
    `<div class="line"><div><b>🌾 Graines</b><br><small>Mangeoire : ${s.feederStock}/${FEEDER_CAPACITY} rations · réserve : ${s.feedReserve}</small></div>${btn("Remplir", "fill-feeder", "small primary", hasFeeder ? "" : "disabled")}</div>` +
    `<div class="line"><div><b>💧 Eau</b><br><small>Abreuvoir : ${s.waterStock}/${WATER_CAPACITY} doses (gratuite)</small></div>${btn("Remplir", "fill-water", "small primary", hasWater ? "" : "disabled")}</div>` +
    `<div class="line"><div><b>🧹 Litière</b><br><small>Propreté du poulailler : ${Math.round(s.cleanliness)}/100</small></div>${btn("Nettoyer", "clean-coop", "small primary", hasCoop && s.cleanedDay !== s.day ? "" : "disabled")}</div>`);
  const need = s.hens.length;
  h += `<p class="muted">Chaque poule consomme 1 ration et 1 dose d'eau par nuit. ${need ? `Pour ${need} poule(s) : ${need} rations/nuit.` : ""}</p>`;
  h += `<h3>Ferme</h3>` + card(`<div class="line"><div><b>Poules</b><br><small>${s.hens.length}/${S.capacity(s) || "—"} (capacité)</small></div><div><b>${coins(s.coins)}</b></div></div>` +
    `<div class="line"><div><b>Œufs en stock</b><br><small>À vendre le dimanche (marché : prix de référence ${S.referencePrice(s)} 🪙)</small></div><div class="big">${S.storedEggs(s)}</div></div>`);
  h += `<h3>Énergie</h3>` + card(`<p><b>${s.energy}/15</b> · une nuit coûte 1 énergie, +1 toutes les 10 minutes (même appli fermée).</p>` +
    (s.energy < 15 ? `<small>Prochaine énergie dans <span id="energyCount">${S.formatCountdown(S.msUntilEnergy(s))}</span></small>` : "<small>Énergie au maximum.</small>") +
    "<p class=\"muted\">Les caresses, soins et récoltes ne coûtent pas d'énergie.</p>");
  h += `<h3>Options</h3>` + card(`<div class="line"><div><b>Vieillissement mortel</b><br><small>Désactivé par défaut : aucune poule ne meurt de vieillesse.</small></div>` +
    btn(s.settings.mortality ? "Activé" : "Désactivé", "toggle-mortality", "small " + (s.settings.mortality ? "on" : "")) + "</div>" +
    `<div class="line"><div><b>Nouvelle partie</b><br><small>Efface la ferme actuelle.</small></div>${btn("Recommencer…", "reset", "small danger")}</div>`);
  h += `<p class="muted" style="text-align:center">Cosy Farm · version de test · sauvegarde automatique sur cet appareil</p>`;
  return { title: "Ma ferme", html: h };
}

function market(s, ctx) {
  const ref = S.referencePrice(s), stock = S.storedEggs(s), m = s.market;
  if (m.session) {
    const sess = m.session, v = S.currentVisitor(s);
    if (!v) return { title: "Marché", html: btn("Fermer le stand", "market-close", "primary") };
    const offer = S.visitorOffer(sess, v), qty = Math.min(v.qty, stock);
    const haggle = offer < sess.price;
    return { title: "Ton stand", html:
      `<p class="muted">Client ${sess.index + 1}/${sess.visitors.length} · ${stock} œuf(s) en stock · gagné : ${sess.earned} 🪙</p>` +
      (sess.message ? `<p class="muted">${esc(sess.message)}</p>` : "") +
      card(`<b>${esc(v.name)}</b> s'arrête devant ton étal.<p>« Je voudrais ${qty} œuf${qty > 1 ? "s" : ""}. ` +
        (haggle ? `${sess.price} 🪙 l'œuf, c'est un peu haut… je te propose <b>${offer} 🪙</b> l'œuf.` : `Ton prix de <b>${sess.price} 🪙</b> l'œuf me va.`) + " »</p>" +
        `<div class="row">${btn(`Vendre à ${offer} 🪙`, "sale-accept", "primary")}${haggle ? btn("Négocier", "sale-counter", "warm") : ""}${btn("Refuser", "sale-skip", "")}</div>`) +
      btn("Fermer le stand", "market-close", "ghost") };
  }
  if (!S.isMarketDay(s)) {
    const d = S.daysUntilMarket(s);
    return { title: "Marché", html: card(`<p>Le marché du village a lieu chaque <b>dimanche</b>. Prochain marché : dans <b>${d} jour${d > 1 ? "s" : ""}</b> (${S.WEEK[6]}).</p>` +
      `<p>Œufs en stock : <b>${stock}</b></p><p class="muted">Prix de référence cette semaine : ${ref} 🪙 l'œuf. Passe des nuits, ramasse tes œufs et garde-les !</p>`) };
  }
  if (m.doneDay === s.day) {
    const l = m.last;
    return { title: "Marché terminé", html: card(`<p class="big">${l ? l.sold : 0} œuf(s) vendus</p><p>${l ? l.earned : 0} 🪙 gagnés${l && l.passed ? ` · ${l.passed} passant(s) sont partis trouvant ton prix trop haut` : ""}.</p>`) +
      '<p class="muted">À dimanche prochain !</p>' };
  }
  const price = ctx.marketPrice || ref;
  const demand = S.demandFactor(price, ref);
  const label = demand > 1.05 ? "Foule nombreuse" : demand > 0.75 ? "Bonne affluence" : demand > 0.4 ? "Affluence moyenne" : "Très peu de passants";
  return { title: "Marché du dimanche", html:
    `<p>C'est jour de marché ! Tu as <b>${stock} œuf(s)</b>.</p>` +
    card(`<label for="marketPrice">Ton prix par œuf</label><input type="range" id="marketPrice" min="1" max="${S.MAX_PRICE}" step="1" value="${price}" data-input="price" />` +
      `<p class="line"><span class="big" id="priceVal">${price} 🪙</span><span class="muted" id="priceDemand">Référence : ${ref} 🪙 · ${label}</span></p>`) +
    btn("Installer mon stand", "market-open", "primary", stock ? "" : "disabled") +
    (stock ? "" : '<p class="muted">Tu n\'as pas d\'œuf à vendre cette semaine.</p>') +
    '<p class="muted">Un prix bas attire du monde ; un prix haut rapporte plus mais fait fuir les clients. Tu pourras négocier.</p>' };
}

export function panelContent(name, s, ctx) {
  switch (name) {
    case "shop": return shop(s);
    case "hens": return hensList(s);
    case "hen": return henSheet(s, ctx);
    case "farm": return farm(s);
    case "market": return market(s, ctx);
    default: return { title: "", html: "" };
  }
}

export function recapHtml(s) {
  const r = s.recap;
  let h = "";
  if (r.bonds.length) h += card("<b>💞 Relations</b>" + r.bonds.map((b) => `<p>${esc(b.name)} : +${b.affection} affection, +${b.trust} confiance</p>`).join(""));
  if (r.sick.length || r.cured.length) {
    h += card("<b>🩺 Santé</b>" + r.sick.map((v) => `<p>${esc(v.name)} ${esc(v.symptom)}. Pense à la soigner.</p>`).join("") + r.cured.map((n) => `<p>${esc(n)} s'est rétablie.</p>`).join(""));
  }
  if (r.warnings.length) h += card("<b>⚠️ À surveiller</b>" + r.warnings.map((v) => `<p>${esc(v)}</p>`).join(""));
  if (r.lines.length) h += card("<b>📖 Événements</b>" + r.lines.map((v) => `<p>${esc(v)}</p>`).join(""));
  if (!h) h = "<p>Une nuit paisible à la ferme. Rien de particulier à signaler.</p>";
  const hens = s.hens.length;
  h += `<p class="muted">Bilan de ${esc(r.weekday)} (jour ${r.day}) · ${hens} poule(s) · ${s.coins} 🪙</p>`;
  return h;
}
