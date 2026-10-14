// Karta podarunkowa: po opłaceniu powstaje jednorazowy kod kwotowy do Skarbca, ważny 6 miesięcy.
// Każda karta dostaje też link do wersji do wydruku (/karta#t=…) z imieniem obdarowanego i słowami od darczyńcy.
import { APP_URL } from "./settings.ts";
import { unitPrice } from "./productPrice.ts";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

function rand(abc, n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => abc[x % abc.length]).join("");
}
const newCode = () => "PREZENT-" + rand("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
const newToken = () => rand("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", 32);

const view = (r) => ({ code: r.code, value: r.value, until: r.valid_until, to_name: r.gift_to || "", message: r.gift_message || "", token: r.gift_token || "" });

// Podpis karty: kwota + dedykacja. Rozpoznajemy po nim, ile kart z danej pozycji już powstało.
const cardKey = (value, toName, message) => `${value}|${clip(toName, 60)}|${clip(message, 200)}`;

// items: pozycje zamówienia; cardIds: id produktów typu „karta”.
// Idempotentnie po numerze zamówienia I po liczbie: jeśli poprzednia próba przerwała się w połowie,
// powtórka dokłada brakujące karty, a już wydanych nie dubluje.
export async function issueGiftCards(base44, orderId, items, cardIds, buyerEmail = "") {
  const Dc = base44.asServiceRole.entities.DiscountCode;
  const tag = `zamówienie ${String(orderId).slice(0, 8).toUpperCase()}`;
  // Klasyczny podpis filter(zapytanie, sortowanie, limit) — działa w każdej wersji SDK funkcji.
  // Błąd odczytu NIE jest połykany: bez listy istniejących kart powtórka wydałaby komplet drugi raz.
  const found = await Dc.filter({ opis: { $regex: tag } }, "created_date", 500);
  const existing = Array.isArray(found) ? found : found?.items || [];

  // Ile kart już jest dla każdej pozycji (kwota + dedykacja).
  const counts = new Map();
  for (const r of existing) {
    const k = cardKey(Math.round(Number(r.value) || 0), r.gift_to, r.gift_message);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  // Cały komplet ma jedną datę ważności — powtórka nie przesuwa jej nowym kartom.
  const until = existing[0]?.valid_until
    || new Date(Date.now() + 183 * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

  const out = existing.map(view);
  for (const it of items.filter((i) => cardIds.includes(String(i.product_id)))) {
    const value = Math.round(Number(it.unitPrice) || 0) / 100;
    const to = clip(it.gift?.to_name, 60);
    const message = clip(it.gift?.message, 200);
    const want = Math.min(20, Number(it.quantity) || 1);
    const have = counts.get(cardKey(value, to, message)) || 0;
    for (let k = have; k < want; k++) {
      const rec = await Dc.create({
        code: newCode(), kind: "kwota", value, max_uses: 1, uses: 0, valid_until: until, active: true,
        opis: `Karta podarunkowa · ${tag}`,
        gift_to: to, gift_message: message,
        gift_token: newToken(), buyer_email: String(buyerEmail || "").trim().toLowerCase(),
      });
      out.push(view(rec));
    }
  }
  return out;
}

export const cardLink = (token) => `${APP_URL}/karta#t=${token}`;

export function giftCardsHtml(cards) {
  if (!cards.length) return "";
  const d = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  const one = (c) => `<div style="margin:0 0 16px;border:1px solid #C9A24A;background:#0A0A0B;padding:24px;">
      <p style="font-size:11px;letter-spacing:.22em;color:#C9A24A;margin:0 0 16px;">EXMORTIS · KARTA PODARUNKOWA</p>
      ${c.to_name ? `<p style="margin:0 0 6px;color:#8A8A8C;font-size:13px;">Dla</p><p style="margin:0 0 14px;color:#E2E2E2;font-size:20px;">${esc(c.to_name)}</p>` : ""}
      ${c.message ? `<p style="margin:0 0 16px;color:#E2E2E2;font-style:italic;line-height:1.6;">„${esc(c.message)}”</p>` : ""}
      <p style="margin:0 0 4px;color:#C9A24A;font-size:26px;">${esc(String(c.value).replace(".", ","))} zł</p>
      <p style="margin:0 0 14px;color:#E2E2E2;">Kod: <b style="color:#C9A24A;letter-spacing:2px;">${esc(c.code)}</b> · ważna do ${esc(d(c.until))}</p>
      ${c.token ? `<p style="margin:0;"><a href="${esc(cardLink(c.token))}" style="color:#C9A24A;">Otwórz kartę do wydruku lub zapisania jako PDF</a></p>` : ""}
    </div>`;
  return `<div style="background:#0A0A0B;padding:0 32px 32px;font-family:Georgia,serif;">
    ${cards.map(one).join("")}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Kod wpisuje się w kasie Skarbca, w polu „kod rabatowy”. Działa jednorazowo — niewykorzystana część kwoty przepada. Kartę możesz wydrukować albo przesłać link osobie obdarowanej. Wszystkie Twoje karty są też w zakładce Zamówienia na koncie.</p></div>`;
}

// Pozycja karty podarunkowej z koszyka → kwota w groszach i słowa na karcie (oczyszczone, z limitami).
export function giftLine(p, it) {
  if (p.product_type !== "karta") return null;
  let opts = p.price_options;
  if (typeof opts === "string") { try { opts = JSON.parse(opts); } catch { opts = null; } }
  const amounts = Array.isArray(opts) ? opts.map(Number).filter((n) => n > 0) : [];
  const want = Number((it || {}).amount);
  const amount = amounts.length ? (amounts.includes(want) ? want : NaN) : unitPrice(p);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Jeden z produktów nie jest już dostępny — wybierz kwotę karty jeszcze raz");
  return { unit: Math.round(amount * 100), gift: { to_name: clip(it?.to_name, 60), message: clip(it?.message, 200) } };
}