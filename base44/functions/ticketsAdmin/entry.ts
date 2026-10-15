import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { runSql, escStr, requireAdmin, emailField } from "../../shared/supabase.ts";
import { loadAppUrl, getSetting, saveSetting } from "../../shared/settings.ts";
import { clearSnap } from "../../shared/snapshot.ts";
import { sendMail } from "../../shared/smtp.ts";
import { ensureTicketSchema, newCode, newToken, showCode, ticketUrl, ticketPdfUrl, loadEvent, eventCounts, checkTicket, cleanName, ticketsHtml, SCANNERS_KEY } from "../../shared/tickets.ts";
import { renderTicketsPdf, cleanLayout } from "../../shared/ticketPdf.ts";

// Bilety — panel administratora: sprzedaż włącz/wyłącz, wzór PDF, lista biletów, ręczne bilety,
// ponowna wysyłka, anulowanie, obecność oraz lista osób z uprawnieniem do skanowania.
const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const uuid = (v) => (/^[0-9a-f-]{36}$/i.test(String(v || "")) ? String(v) : null);

async function mailTickets(base44, ev, list, to) {
  const html = `<div style="background:#0A0A0B;padding:32px 32px 8px;font-family:Georgia,serif;color:#E2E2E2;">
      <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
      <h1 style="font-size:24px;">Twój bilet</h1></div>${ticketsHtml(list, new Map([[ev.id, ev]]))}`;
  return sendMail(base44, { kind: "bilet", ref: String(list[0].id), to, subject: `EXMORTIS · Bilet — ${ev.title}`, html, waznyDo: ev.start_datetime || undefined });
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await requireAdmin(base44);
    await loadAppUrl(base44);
    await ensureTicketSchema(base44);
    const body = await req.json().catch(() => ({}));
    const a = body.action;

    if (a === "get") {
      const ev = await loadEvent(base44, String(body.event_id || ""));
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      const rows = await runSql(base44, `SELECT id, code, token, holder_name, buyer_email, price::float8 AS price, source, status, checked_at, checked_by, order_id, created_at
        FROM public.event_tickets WHERE event_id = ${escStr(ev.id)} ORDER BY created_at, line_no`, true);
      const scanners = ((await getSetting(base44, SCANNERS_KEY).catch(() => null)) || []).filter((s) => !s.event_id || s.event_id === ev.id);
      return Response.json({
        event: { ...ev, ticket_template: ev.ticket_template ? cleanLayout(ev.ticket_template) : null },
        counts: await eventCounts(base44, ev.id),
        tickets: rows.map((r) => ({ ...r, code: showCode(r.code), link: ticketUrl(r.token), pdf: ticketPdfUrl(r.token), token: undefined })),
        scanners,
      });
    }

    if (a === "save") {
      const ev = await loadEvent(base44, String(body.event_id || ""));
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      const sets = [];
      if (body.tickets === true && ev.format === "Online") return Response.json({ error: "Bilety są tylko na spotkania stacjonarne." }, { status: 400 });
      if (typeof body.tickets === "boolean") sets.push(`tickets = ${body.tickets ? "TRUE" : "FALSE"}`);
      if (body.template !== undefined) sets.push(`ticket_template = ${body.template ? `${escStr(JSON.stringify(cleanLayout(body.template)))}::jsonb` : "NULL"}`);
      if (sets.length) await runSql(base44, `UPDATE public.events SET ${sets.join(", ")} WHERE id = ${escStr(ev.id)}`);
      await clearSnap(base44, "events:").catch(() => {});
      return Response.json({ ok: true });
    }

    // Podgląd PDF z przykładowymi danymi (przed zapisaniem wzoru).
    if (a === "test_pdf") {
      const ev = (await loadEvent(base44, String(body.event_id || ""))) || { title: "Przykładowe wydarzenie" };
      const bytes = await renderTicketsPdf(ev, body.template ?? ev.ticket_template, [{ holder_name: String(body.sample_name || "Anna Kowalska-Wiśniewska").slice(0, 80), code: "KRT-4821", qr: ticketUrl("PrzykladowyKluczBiletuDoPodgladu12") }]);
      return Response.json({ pdf: b64(bytes) });
    }

    // Bilet dodany ręcznie (gość, zaproszenie, płatność poza stroną) — z opcjonalnym e-mailem.
    if (a === "add") {
      const ev = await loadEvent(base44, String(body.event_id || ""));
      if (!ev) return Response.json({ error: "Nie znaleziono wydarzenia" }, { status: 404 });
      const name = cleanName(body.name);
      if (name.length < 3) return Response.json({ error: "Podaj imię i nazwisko" }, { status: 400 });
      const email = body.email ? emailField(body).toLowerCase() : null;
      let row = null;
      for (let i = 0; i < 6 && !row; i++) {
        row = (await runSql(base44, `INSERT INTO public.event_tickets (code, token, event_id, holder_name, buyer_email, price, source)
          VALUES (${escStr(newCode())}, ${escStr(newToken())}, ${escStr(ev.id)}, ${escStr(name)}, ${email ? escStr(email) : "NULL"}, 0, 'recznie')
          ON CONFLICT DO NOTHING RETURNING *`))?.[0] || null;
      }
      if (!row) throw new Error("Nie udało się nadać numeru biletu");
      let mailed = false;
      if (email && body.send === true) { await mailTickets(base44, ev, [row], email); mailed = true; }
      return Response.json({ ok: true, code: showCode(row.code), mailed });
    }

    if (a === "resend") {
      const id = uuid(body.ticket_id);
      const [t] = id ? await runSql(base44, `SELECT * FROM public.event_tickets WHERE id = ${escStr(id)}`, true) : [];
      if (!t) return Response.json({ error: "Nie znaleziono biletu" }, { status: 404 });
      const to = body.email ? emailField(body).toLowerCase() : t.buyer_email;
      if (!to) return Response.json({ error: "Brak adresu e-mail — wpisz go" }, { status: 400 });
      const ev = await loadEvent(base44, t.event_id);
      await mailTickets(base44, ev, [t], to);
      return Response.json({ ok: true, to });
    }

    if (a === "cancel" || a === "restore") {
      const id = uuid(body.ticket_id);
      if (!id) return Response.json({ error: "Nie znaleziono biletu" }, { status: 404 });
      const r = await runSql(base44, a === "cancel"
        ? `UPDATE public.event_tickets SET status = 'anulowany' WHERE id = ${escStr(id)} AND status <> 'anulowany' RETURNING id`
        : `UPDATE public.event_tickets SET status = CASE WHEN checked_at IS NULL THEN 'wazny' ELSE 'wykorzystany' END WHERE id = ${escStr(id)} AND status = 'anulowany' RETURNING id`);
      return Response.json({ ok: !!r?.length });
    }

    if (a === "checkin") {
      const id = uuid(body.ticket_id);
      const [t] = id ? await runSql(base44, `SELECT token FROM public.event_tickets WHERE id = ${escStr(id)}`, true) : [];
      if (!t) return Response.json({ error: "Nie znaleziono biletu" }, { status: 404 });
      return Response.json(await checkTicket(base44, { scan: { token: t.token }, eventId: null, by: me.email, scope: { all: true, admin: true }, undo: body.undo === true }));
    }

    // Uprawnienia do skanowania: [{ email, event_id | null, until | null }].
    if (a === "scanners_get") {
      const list = (await getSetting(base44, SCANNERS_KEY).catch(() => null)) || [];
      return Response.json({ scanners: list });
    }
    if (a === "scanners_save") {
      const seen = new Set();
      const list = (Array.isArray(body.scanners) ? body.scanners : []).slice(0, 100).map((s) => {
        const email = String(s?.email || "").trim().toLowerCase().slice(0, 200);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Niepoprawny adres e-mail: ${email || "(pusty)"}`);
        const event_id = s?.event_id ? String(s.event_id).slice(0, 64) : null;
        const until = s?.until ? new Date(s.until) : null;
        if (until && isNaN(until.getTime())) throw new Error("Niepoprawna data ważności uprawnienia");
        return { email, event_id, until: until ? until.toISOString() : null, note: String(s?.note || "").slice(0, 120), added_at: s?.added_at || new Date().toISOString() };
      }).filter((s) => { const k = `${s.email}|${s.event_id || ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
      await saveSetting(base44, SCANNERS_KEY, list);
      return Response.json({ ok: true, scanners: list });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    if (e?.message === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    console.error("ticketsAdmin:", e?.message);
    return Response.json({ error: e?.message || "Błąd" }, { status: 400 });
  }
}
