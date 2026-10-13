// Jedno przypomnienie o nieopłaconym zamówieniu: 3–48 h po porzuceniu płatności, tylko gdy ta osoba nic później nie opłaciła.
import { runSql, escStr } from "./supabase.ts";
import { sendMail } from "./smtp.ts";
import { loadAppUrl } from "./settings.ts";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function unpaidReminders(base44, limit = 20) {
  await runSql(base44, `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminded_at timestamptz`);
  const rows = await runSql(base44, `SELECT o.id, o.buyer_name, o.buyer_email, o.items FROM public.orders o
    WHERE o.status IN ('NEW','PENDING') AND o.reminded_at IS NULL AND o.buyer_email IS NOT NULL
      AND o.created_date < now() - interval '3 hours' AND o.created_date > now() - interval '48 hours'
      AND NOT EXISTS (SELECT 1 FROM public.orders x WHERE lower(x.buyer_email) = lower(o.buyer_email)
        AND x.status = 'COMPLETED' AND x.created_date >= o.created_date)
    ORDER BY o.created_date LIMIT ${Number(limit) || 20}`, true);
  if (!rows.length) return 0;
  const url = await loadAppUrl(base44);
  let n = 0;
  for (const o of rows) {
    // Najpierw oznaczamy — nikt nie dostanie przypomnienia dwa razy, nawet przy błędzie wysyłki.
    const took = await runSql(base44, `UPDATE public.orders SET reminded_at = now() WHERE id = ${escStr(o.id)} AND reminded_at IS NULL RETURNING id`);
    if (!took.length) continue;
    const items = Array.isArray(o.items) ? o.items : [];
    const list = items.map((i) => `<li style="margin-bottom:6px;">${esc(i.name || i.title || "")}</li>`).join("");
    const first = String(o.buyer_name || "").trim().split(/\s+/)[0];
    const html = `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
      <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
      ${first ? `<p style="color:#8A8A8C;">${esc(first)},</p>` : ""}
      <h1 style="font-size:22px;">Płatność nie została dokończona</h1>
      <p style="line-height:1.7;">Zamówienie czeka, ale nie dostałem potwierdzenia płatności:</p>
      <ul style="line-height:1.6;">${list}</ul>
      <p style="line-height:1.7;color:#8A8A8C;">Jeśli coś przerwało płatność, możesz złożyć zamówienie jeszcze raz. Jeśli zrezygnowałeś, zignoruj tę wiadomość — to jedyne przypomnienie.</p>
      <p style="margin:28px 0;"><a href="${url}/skarbiec" style="background:#C9A24A;color:#0A0A0B;padding:14px 22px;text-decoration:none;letter-spacing:2px;font-size:13px;">WRÓĆ DO SKARBCA</a></p>
    </div>`;
    try {
      await sendMail(base44, { to: o.buyer_email, subject: "EXMORTIS · płatność nie została dokończona", html, kind: "przypomnienie_platnosci", ref: o.id });
      n++;
    } catch { /* zostaje w dzienniku poczty */ }
  }
  return n;
}