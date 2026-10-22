import { createClientFromRequest } from "../_shared/compat.ts";
import { getSetting } from "../_shared/settings.ts";
import { clientIp } from "../_shared/supabase.ts";
import { sendMail as gate, adminTo } from "../_shared/smtp.ts";
const sendMail = (b, m) => gate(b, { kind: "odstapienie", ...m });

const s = (v, max) => String(v ?? "").trim().slice(0, max);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Odstąpienie od umowy online — bez logowania, potwierdzenie e-mailem z datą i godziną wpływu.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const b = await req.json().catch(() => ({}));
    const data = {
      name: s(b.name, 200), email: s(b.email, 200).toLowerCase(), order_id: s(b.order_id, 100),
      product: s(b.product, 300), order_date: s(b.order_date, 20), reason: s(b.reason, 2000),
    };
    if (!data.name || !data.product || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      return Response.json({ error: "Uzupełnij imię i nazwisko, produkt i poprawny e-mail." }, { status: 400 });
    }
    const received_at = new Date().toISOString();
    const ip = clientIp(req);
    // Ochrona przed masowym wysyłaniem potwierdzeń na cudze adresy: 5 zgłoszeń na godzinę z jednego IP.
    // Licznik nigdy nie blokuje prawa do odstąpienia przy błędzie technicznym (fail-open).
    let tooMany = false;
    try {
      const L = base44.asServiceRole.entities.SecurityLog;
      const recent = await L.filter({ type: "odstapienie", ip, created_date: { $gte: new Date(Date.now() - 3600000).toISOString() } }, "-created_date", 6);
      tooMany = recent.length >= 5;
      if (!tooMany) await L.create({ type: "odstapienie", ip, details: data.email.slice(0, 80) });
    } catch {
      tooMany = false;
    }
    if (tooMany) return Response.json({ error: "Zbyt wiele zgłoszeń z tego połączenia. Spróbuj za godzinę albo napisz na adres kontaktowy." }, { status: 429 });
    await base44.asServiceRole.entities.Withdrawal.create({ ...data, received_at, ip, status: "odstąpienie zgłoszone" });

    const when = new Date(received_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
    const smtp = base44;
    {
      const rows = `<p>Zamówienie: ${esc(data.order_id || "—")}<br>Produkt: ${esc(data.product)}<br>Data zawarcia umowy: ${esc(data.order_date || "—")}<br>Data i godzina wpływu: ${when}</p>`;
      await sendMail(smtp, { to: data.email, subject: "Potwierdzenie otrzymania odstąpienia od umowy", html: `<p>${esc(data.name)}, otrzymałem Twoje oświadczenie o odstąpieniu od umowy.</p>${rows}<p>Zwrot płatności nastąpi nie później niż w 14 dni.</p>` }).catch(() => {});
      const admin = await adminTo(base44);
      if (admin) await sendMail(smtp, { to: admin, subject: `Odstąpienie od umowy: ${data.order_id || data.product}`, html: `<p>${esc(data.name)} (${esc(data.email)})</p>${rows}<p>Powód: ${esc(data.reason || "—")}</p>` }).catch(() => {});
    }
    return Response.json({ ok: true, received_at });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Nie udało się zapisać zgłoszenia." }, { status: 500 });
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
