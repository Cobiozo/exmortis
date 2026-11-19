// Jedno spokojne przypomnienie o nieopłaconym zamówieniu (19.11.2026):
// • wysyłane, gdy zamówienie ma 24 h i nadal nie jest opłacone (okno 24–72 h);
// • PayU unieważnia nieopłaconą płatność po ok. 24 h (status CANCELED) — taka też dostaje przypomnienie,
//   bo przycisk prowadzi do produktu, a nie do starego linku płatności;
// • tylko jedno na osobę: o najnowszym nieopłaconym zamówieniu, nie częściej niż raz na 7 dni,
//   i nigdy, gdy ta osoba później coś opłaciła albo złożyła nowe zamówienie;
// • bez zamówień darmowych (FREE-) i bez Rozmowy na progu (ma własny proces płatności).
import { runSql, escStr } from "./supabase.ts";
import { sendMail } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";
import { emailButton } from "./emailLayout.ts";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const P = (t, extra = "") => `<p style="margin:0 0 18px;line-height:1.7;${extra}">${t}</p>`;
const LABEL = (t) => `<p style="margin:0 0 14px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;">${t}</p>`;
const zl = (gr) => {
  const v = Number(gr) / 100;
  return Number.isFinite(v) && v > 0 ? `${v.toFixed(2).replace(/\.00$/, "").replace(".", ",")} zł` : "";
};
const plDate = (iso) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" });

export function unpaidMail(o, url, back) {
  const items = Array.isArray(o.items) ? o.items : [];
  const rows = items.map((i) => {
    const q = Number(i.quantity) > 1 ? ` × ${Number(i.quantity)}` : "";
    const price = zl(i.unitPrice);
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #2A2620;">${esc(i.name || i.title || "")}${q}</td>
      <td style="padding:10px 0 10px 16px;border-bottom:1px solid #2A2620;text-align:right;white-space:nowrap;color:#A3A3A6;">${price}</td></tr>`;
  }).join("");
  const first = String(o.buyer_name || "").trim().split(/\s+/)[0];
  const html = [
    LABEL(`ZAMÓWIENIE Z ${esc(plDate(o.created_date)).toUpperCase()}`),
    P(first ? `${esc(first)},` : "Dzień dobry,"),
    P("w Skarbcu exmortis czeka Twoje zamówienie, ale nie dostałem potwierdzenia płatności."),
    rows ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 22px;border-collapse:collapse;">${rows}</table>` : "",
    P("Płatność często przerywa coś zwyczajnego: bank, wygasła sesja, telefon, który akurat zadzwonił. Jeśli chcesz dokończyć, wystarczy wrócić do produktu — kasa pokaże aktualną cenę."),
    emailButton("Wróć do zamówienia", back),
    P("Jeśli to była świadoma decyzja, nie musisz nic robić. To jedyna wiadomość w tej sprawie i nie zapisuje Cię na żadną listę.", "color:#A3A3A6;"),
    P("Gdyby płatność nie przechodziła albo pojawiło się pytanie o materiał, odpowiedz na tę wiadomość. Odpowiadam sam.", "color:#A3A3A6;font-size:14px;"),
    `<p style="margin:30px 0 0;">Dawid</p>`,
  ].join("");
  return {
    subject: "EXMORTIS · Twoje zamówienie czeka",
    preheader: "Płatność nie została dokończona. Jeśli chcesz, możesz do niej wrócić.",
    html,
  };
}

export async function unpaidReminders(base44, limit = 20) {
  const notFree = (t) => `COALESCE(${t}.payu_order_id, '') NOT LIKE 'FREE-%'`;
  const rows = await runSql(base44, `SELECT o.id, o.buyer_name, o.buyer_email, o.items, o.created_date FROM public.orders o
    WHERE o.status IN ('NEW','PENDING','CANCELED') AND o.reminded_at IS NULL AND o.buyer_email IS NOT NULL
      AND o.prog_app_id IS NULL AND COALESCE(o.is_test, false) = false
      AND ${notFree("o")}
      AND COALESCE(o.payu_status, '') NOT IN ('WAITING_FOR_CONFIRMATION', 'CAPTURE_REQUESTED', 'MISMATCH', 'COMPLETED')
      AND COALESCE(o.refunded_total, 0) = 0
      AND o.created_date < now() - interval '24 hours' AND o.created_date > now() - interval '72 hours'
      AND NOT EXISTS (SELECT 1 FROM public.orders x WHERE lower(x.buyer_email) = lower(o.buyer_email)
        AND x.id <> o.id AND x.created_date > o.created_date AND ${notFree("x")})
      AND NOT EXISTS (SELECT 1 FROM public.orders x WHERE lower(x.buyer_email) = lower(o.buyer_email)
        AND x.status = 'COMPLETED' AND x.created_date >= o.created_date)
      AND NOT EXISTS (SELECT 1 FROM public.orders x WHERE lower(x.buyer_email) = lower(o.buyer_email)
        AND x.reminded_at > now() - interval '7 days')
    ORDER BY o.created_date LIMIT ${Number(limit) || 20}`, true);
  if (!rows.length) return 0;
  const url = await loadAppUrl(base44);
  let n = 0;
  for (const o of rows) {
    // Najpierw oznaczamy — nikt nie dostanie przypomnienia dwa razy, nawet przy błędzie wysyłki.
    const took = await runSql(base44, `UPDATE public.orders SET reminded_at = now() WHERE id = ${escStr(o.id)} AND reminded_at IS NULL RETURNING id`);
    if (!took.length) continue;
    const items = Array.isArray(o.items) ? o.items : [];
    // Przycisk prowadzi prosto do produktu, gdy w zamówieniu jest jeden produkt Skarbca (inaczej — do Skarbca).
    const pids = [...new Set(items.map((i) => String(i.product_id || "")).filter((v) => v && !v.startsWith("bilet")))];
    const prod = pids.length === 1 ? await runSql(base44, `SELECT slug FROM public.products WHERE id::text = ${escStr(pids[0])} AND slug IS NOT NULL LIMIT 1`, true).catch(() => []) : [];
    const back = prod?.[0]?.slug ? `${url}/skarbiec/${encodeURIComponent(prod[0].slug)}?src=przypomnienie` : `${url}/skarbiec?src=przypomnienie`;
    const mail = unpaidMail(o, url, back);
    try {
      await sendMail(base44, { to: o.buyer_email, subject: mail.subject, html: mail.html, preheader: mail.preheader, kind: "przypomnienie_platnosci", ref: o.id });
      n++;
    } catch { /* zostaje w dzienniku poczty */ }
  }
  return n;
}
