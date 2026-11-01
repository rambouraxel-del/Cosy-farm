// Marché du dimanche : stand, clients simulés, prix libre et négociation simple.
import { EGG_REF_PRICE, CUSTOMER_NAMES } from "./data.js";
import { rand, between, intBetween, pick, hashRand } from "./rng.js";
import { ok, fail, clamp, isMarketDay, weekIndex, storedEggs } from "./state.js";

export const MAX_PRICE = 12;

export function referencePrice(s) {
  return EGG_REF_PRICE[Math.floor(hashRand(s.seed + weekIndex(s) * 7919) * EGG_REF_PRICE.length)];
}
export const canOpenMarket = (s) => isMarketDay(s) && s.market.doneDay !== s.day && !s.market.session;

// Le nombre de passants baisse quand le prix s'éloigne de la référence.
export function demandFactor(price, ref) {
  return clamp(1.5 - 0.55 * (price / ref), 0.1, 1.3);
}

export function openMarket(s, price) {
  if (!isMarketDay(s)) return fail("Le marché n'a lieu que le dimanche.");
  if (s.market.doneDay === s.day) return fail("Tu as déjà tenu ton stand aujourd'hui.");
  if (s.market.session) return fail("Ton stand est déjà ouvert.");
  if (storedEggs(s) === 0) return fail("Tu n'as aucun œuf à vendre.");
  price = Math.round(price);
  if (!(price >= 1 && price <= MAX_PRICE)) return fail("Choisis un prix entre 1 et " + MAX_PRICE + ".");
  const ref = referencePrice(s);
  const count = Math.max(2, Math.round((5 + s.reputation * 0.6) * demandFactor(price, ref)));
  const visitors = [];
  let passed = 0;
  for (let i = 0; i < count; i++) {
    const wtp = ref * between(s, 0.6, 1.5);
    const v = {
      name: pick(s, CUSTOMER_NAMES), qty: intBetween(s, 1, 3), wtp: Math.round(wtp * 10) / 10,
      haggle: Math.round(rand(s) * 100) / 100,
    };
    if (v.wtp < price * 0.5) passed += 1; // passe sans s'arrêter
    else visitors.push(v);
  }
  s.market.session = { price, ref, visitors, index: 0, sold: 0, earned: 0, passed, message: "" };
  if (!visitors.length) return closeMarket(s, "Personne ne s'est arrêté : ton prix est peut-être trop élevé.");
  return ok("Ton stand est ouvert.");
}

export function currentVisitor(s) {
  const m = s.market.session;
  return m ? m.visitors[m.index] || null : null;
}
export function visitorOffer(m, v) {
  return v.wtp >= m.price ? m.price : Math.max(1, Math.floor(v.wtp));
}

function sell(s, qty, unit) {
  let left = qty;
  for (const e of s.eggs) {
    if (!left) break;
    if (e.status === "stored") { e.status = "sold"; left -= 1; }
  }
  s.eggs = s.eggs.filter((e) => e.status !== "sold");
  const earned = (qty - left) * unit;
  s.coins += earned;
  s.stats.eggsSold += qty - left;
  s.stats.coinsEarned += earned;
  return { sold: qty - left, earned };
}

export function marketDecision(s, choice) {
  const m = s.market.session, v = currentVisitor(s);
  if (!m || !v) return fail("Aucun client.");
  const qty = Math.min(v.qty, storedEggs(s));
  let msg = "";
  if (choice === "accept") {
    const unit = visitorOffer(m, v);
    const r = sell(s, qty, unit);
    m.sold += r.sold; m.earned += r.earned;
    s.reputation = clamp(s.reputation + (unit <= m.ref * 1.2 ? 0.2 : 0) * r.sold, 0, 10);
    msg = `${v.name} repart avec ${r.sold} œuf(s) pour ${r.earned} pièces.`;
  } else if (choice === "counter") {
    const offer = visitorOffer(m, v);
    if (offer >= m.price) return fail("Ce client accepte déjà ton prix.");
    const mid = Math.round((offer + m.price) / 2);
    if (mid <= v.wtp * (1 + 0.3 * v.haggle)) {
      const r = sell(s, qty, mid);
      m.sold += r.sold; m.earned += r.earned;
      msg = `Marché conclu : ${v.name} prend ${r.sold} œuf(s) à ${mid} pièces l'œuf.`;
    } else {
      msg = `${v.name} trouve ça trop cher et s'en va.`;
    }
  } else if (choice === "skip") {
    msg = `Tu laisses partir ${v.name}.`;
  } else return fail("Choix inconnu.");
  m.message = msg;
  m.index += 1;
  if (m.index >= m.visitors.length || storedEggs(s) === 0) return closeMarket(s, msg);
  return ok(msg);
}

export function closeMarket(s, msg = "") {
  const m = s.market.session;
  if (!m) return fail("Ton stand n'est pas ouvert.");
  s.market.last = { day: s.day, sold: m.sold, earned: m.earned, passed: m.passed, price: m.price, ref: m.ref };
  s.market.doneDay = s.day;
  s.market.session = null;
  return ok(msg || "Le marché est terminé.", { closed: true });
}
