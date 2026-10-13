// Karta podarunkowa: po opłaceniu powstaje jednorazowy kod kwotowy do Skarbca, ważny 6 miesięcy.
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(10));
  return "PREZENT-" + [...b].map((x) => abc[x % abc.length]).join("");
}

// items: pozycje zamówienia; cardIds: id produktów typu „karta”. Idempotentnie po numerze zamówienia.
export async function issueGiftCards(base44, orderId, items, cardIds) {
  const Dc = base44.asServiceRole.entities.DiscountCode;
  const tag = `zamówienie ${String(orderId).slice(0, 8).toUpperCase()}`;
  const had = await Dc.filter({ opis: { $regex: tag } }).catch(() => []);
  if (had.length) return had.map((r) => ({ code: r.code, value: r.value, until: r.valid_until }));
  const until = new Date(Date.now() + 183 * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
  const out = [];
  for (const it of items.filter((i) => cardIds.includes(String(i.product_id)))) {
    for (let k = 0; k < Math.min(20, Number(it.quantity) || 1); k++) {
      const value = Math.round(Number(it.unitPrice) || 0) / 100;
      const code = newCode();
      await Dc.create({ code, kind: "kwota", value, max_uses: 1, uses: 0, valid_until: until, active: true, opis: `Karta podarunkowa · ${tag}` });
      out.push({ code, value, until });
    }
  }
  return out;
}

export function giftCardsHtml(cards) {
  if (!cards.length) return "";
  const d = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
  return `<div style="margin-top:28px;border:1px solid #C9A24A;padding:20px;">
    <p style="font-size:11px;letter-spacing:.18em;color:#C9A24A;margin:0 0 12px;">KARTA PODARUNKOWA</p>
    ${cards.map((c) => `<p style="margin:0 0 10px;color:#E2E2E2;">Kod: <b style="color:#C9A24A;letter-spacing:2px;">${esc(c.code)}</b><br>Kwota: ${esc(String(c.value).replace(".", ","))} zł · ważna do ${esc(d(c.until))}</p>`).join("")}
    <p style="margin:0;color:#8A8A8C;font-size:13px;line-height:1.6;">Kod wpisuje się w kasie Skarbca, w polu „kod rabatowy”. Działa jednorazowo — niewykorzystana część kwoty przepada.</p></div>`;
}