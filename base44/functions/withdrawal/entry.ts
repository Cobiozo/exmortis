import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { getSetting } from "../../shared/settings.ts";
import { sendMail } from "../../shared/smtp.ts";

const s = (v, max) => String(v ?? "").trim().slice(0, max);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Odstąpienie od umowy online — bez logowania, potwierdzenie e-mailem z datą i godziną wpływu.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const b = await req.json().catch(() => ({}));
    const data = {
      name: s(b.name, 200), email: s(b.email, 200).toLowerCase(), order_id: s(b.order_id, 100),
      product: s(b.product, 300), order_date: s(b.order_date, 20), reason: s(b.reason, 2000),
    };
    if (!data.name || !data.order_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      return Response.json({ error: "Uzupełnij imię i nazwisko, numer zamówienia i poprawny e-mail." }, { status: 400 });
    }
    const received_at = new Date().toISOString();
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    await base44.asServiceRole.entities.Withdrawal.create({ ...data, received_at, ip, status: "odstąpienie zgłoszone" });

    const when = new Date(received_at).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
    const smtp = await getSetting(base44, "smtp").catch(() => null);
    if (smtp) {
      const rows = `<p>Zamówienie: ${esc(data.order_id)}<br>Produkt: ${esc(data.product)}<br>Data zamówienia: ${esc(data.order_date || "—")}<br>Data i godzina wpływu: ${when}</p>`;
      await sendMail(smtp, { to: data.email, subject: "Potwierdzenie otrzymania odstąpienia od umowy", html: `<p>${esc(data.name)}, otrzymaliśmy Twoje oświadczenie o odstąpieniu od umowy.</p>${rows}<p>Zwrot płatności nastąpi nie później niż w 14 dni.</p><p>[NAZWA FIRMY], [ADRES DZIAŁALNOŚCI], NIP [NIP]</p>` }).catch(() => {});
      const admin = smtp.adminEmail || smtp.from;
      if (admin) await sendMail(smtp, { to: admin, subject: `Odstąpienie od umowy: ${data.order_id}`, html: `<p>${esc(data.name)} (${esc(data.email)})</p>${rows}<p>Powód: ${esc(data.reason || "—")}</p>` }).catch(() => {});
    }
    return Response.json({ ok: true, received_at });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Nie udało się zapisać zgłoszenia." }, { status: 500 });
  }
}