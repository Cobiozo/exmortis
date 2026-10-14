import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { runSql, escStr, textField } from "../../shared/supabase.ts";
import { loadAppUrl } from "../../shared/settings.ts";
import { ensureTicketSchema, validToken, showCode, ticketUrl, ticketPdfUrl, salesClosed, seatsTaken, scannerScope, canScan, checkTicket, parseScan, eventCounts } from "../../shared/tickets.ts";
import { renderTicketsPdf } from "../../shared/ticketPdf.ts";

// Bilety — strona publiczna i skaner:
//  GET ?pdf=<klucz>  → PDF biletu (link z e-maila i z konta),
//  view / availability / mine — dane biletu, wolne miejsca, bilety zalogowanej osoby,
//  scanner / check / stats — tylko administrator albo osoba z uprawnieniem do skanowania.
const bad = (error, status = 400) => Response.json({ error }, { status });

async function ticketByToken(base44, token) {
  const rows = await runSql(base44, `SELECT t.id, t.code, t.token, t.holder_name, t.status, t.checked_at, t.event_id,
      e.title, e.slug, e.start_datetime, e.duration_minutes, e.format, e.location, e.ticket_template, e.short_path
    FROM public.event_tickets t JOIN public.events e ON e.id = t.event_id WHERE t.token = ${escStr(token)}`, true);
  return rows?.[0] || null;
}

// Prosty limit dla skanowania (w pamięci instancji): 240 sprawdzeń na minutę na osobę.
const HITS = new Map();
function tooFast(key) {
  const now = Date.now(), h = (HITS.get(key) || []).filter((t) => now - t < 60000);
  h.push(now); HITS.set(key, h);
  // Mapa nie rośnie bez końca: przy wielu różnych skanerach usuwamy wpisy bez świeżych sprawdzeń.
  if (HITS.size > 500) for (const [k, v] of HITS) if (!v.some((t) => now - t < 60000)) HITS.delete(k);
  return h.length > 240;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    const url = new URL(req.url);

    // PDF do pobrania: zwykły link (działa w programie pocztowym, bez logowania — klucz zna tylko właściciel biletu).
    const pdfToken = url.searchParams.get("pdf");
    if (pdfToken !== null) {
      if (!validToken(pdfToken)) return new Response("Nieprawidłowy link do biletu.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      await ensureTicketSchema(base44);
      const t = await ticketByToken(base44, pdfToken);
      if (!t || t.status === "anulowany") return new Response("Ten bilet nie istnieje albo został anulowany.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      const bytes = await renderTicketsPdf(t, t.ticket_template, [{ holder_name: t.holder_name, code: showCode(t.code), qr: ticketUrl(t.token) }]);
      return new Response(bytes, { headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="bilet-${showCode(t.code)}.pdf"`,
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex",
      } });
    }

    const body = await req.json().catch(() => ({}));
    const a = body.action;
    await ensureTicketSchema(base44);

    if (a === "view") {
      if (!validToken(body.token)) return bad("Nie ma takiego biletu", 404);
      const t = await ticketByToken(base44, body.token);
      if (!t) return bad("Nie ma takiego biletu", 404);
      return Response.json({ ticket: {
        code: showCode(t.code), holder_name: t.holder_name, status: t.status, checked_at: t.checked_at,
        qr: ticketUrl(t.token), pdf: ticketPdfUrl(t.token),
        event: { title: t.title, slug: t.slug, start_datetime: t.start_datetime, duration_minutes: t.duration_minutes, format: t.format,
          location: t.format === "Online" ? null : t.location },
      } });
    }

    // Wolne miejsca i stan sprzedaży (strona wydarzenia).
    if (a === "availability") {
      const slug = textField(body, "slug", { max: 200 });
      const [ev] = await runSql(base44, `SELECT id, status, price::float8 AS price, capacity, start_datetime, registration_deadline, COALESCE(tickets, false) AS tickets
        FROM public.events WHERE slug = ${escStr(slug)}`, true);
      if (!ev) return bad("Nie znaleziono wydarzenia", 404);
      const closed = salesClosed(ev);
      let left = null;
      if (Number(ev.capacity) > 0) {
        const s = await seatsTaken(base44, ev.id);
        left = Math.max(0, Number(ev.capacity) - s.sold - s.pending);
      }
      return Response.json({ on_sale: !closed && left !== 0, reason: closed || (left === 0 ? "Wszystkie bilety są wyprzedane." : null),
        price: ev.price, left, max: Math.min(10, left ?? 10) });
    }

    const me = await base44.auth.me().catch(() => null);
    if (!me) return bad("Zaloguj się", 401);

    // Moje konto → Spotkania: bilety kupione tym adresem.
    if (a === "mine") {
      const rows = await runSql(base44, `SELECT t.code, t.token, t.holder_name, t.status, t.checked_at, e.title, e.slug, e.start_datetime, e.format
        FROM public.event_tickets t JOIN public.events e ON e.id = t.event_id
        WHERE lower(t.buyer_email) = ${escStr(String(me.email || "").toLowerCase())} AND t.status <> 'anulowany'
        ORDER BY e.start_datetime DESC NULLS LAST, t.code LIMIT 200`, true);
      return Response.json({ tickets: rows.map((r) => ({ code: showCode(r.code), holder_name: r.holder_name, status: r.status, checked_at: r.checked_at,
        title: r.title, slug: r.slug, start_datetime: r.start_datetime, format: r.format, pdf: ticketPdfUrl(r.token), link: `/bilet#t=${r.token}` })) });
    }

    // ---- Skaner ----
    const scope = await scannerScope(base44, me);
    if (a === "scanner") {
      if (!scope) return Response.json({ allowed: false });
      const rows = await runSql(base44, `SELECT id, title, slug, start_datetime, duration_minutes, format, capacity FROM public.events
        WHERE COALESCE(tickets, false) = TRUE AND status IN ('Opublikowane','Odwołane') AND start_datetime IS NOT NULL
          AND start_datetime > now() - interval '2 days' AND start_datetime < now() + interval '60 days'
        ORDER BY start_datetime LIMIT 50`, true);
      const events = rows.filter((e) => canScan(scope, e.id));
      return Response.json({ allowed: true, admin: !!scope.admin, events });
    }
    if (!scope) return bad("Nie masz uprawnienia do sprawdzania biletów.", 403);

    if (a === "check") {
      if (tooFast(String(me.email))) return bad("Za szybko — poczekaj chwilę.", 429);
      const scan = body.token ? (validToken(body.token) ? { token: body.token } : null) : parseScan(body.raw || body.code);
      if (!scan) return Response.json({ result: "nieczytelny" });
      const eventId = body.event_id ? String(body.event_id).slice(0, 64) : null;
      if (eventId && !canScan(scope, eventId)) return bad("Nie masz uprawnienia do tego wydarzenia.", 403);
      const r = await checkTicket(base44, { scan, eventId, by: String(me.email || me.full_name || "skaner").slice(0, 120), scope, undo: body.undo === true });
      if (eventId) Object.assign(r, { counts: await eventCounts(base44, eventId) });
      return Response.json(r);
    }

    if (a === "stats") {
      const eventId = String(body.event_id || "").slice(0, 64);
      if (!canScan(scope, eventId)) return bad("Nie masz uprawnienia do tego wydarzenia.", 403);
      const recent = await runSql(base44, `SELECT code, holder_name, checked_at, checked_by FROM public.event_tickets
        WHERE event_id = ${escStr(eventId)} AND status = 'wykorzystany' ORDER BY checked_at DESC LIMIT 15`, true);
      return Response.json({ counts: await eventCounts(base44, eventId),
        recent: recent.map((r) => ({ code: showCode(r.code), name: r.holder_name, at: r.checked_at, by: r.checked_by })) });
    }

    return bad("Nieznana akcja");
  } catch (e) {
    console.error("tickets:", e?.message);
    return Response.json({ error: /^(Brak pola|Pole )/.test(String(e?.message)) ? e.message : "Coś poszło nie tak. Spróbuj ponownie." }, { status: 500 });
  }
}