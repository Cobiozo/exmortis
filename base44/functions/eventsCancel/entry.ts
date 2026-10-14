import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql, escStr } from "../../shared/supabase.ts";
import { getSetting, loadAppUrl } from "../../shared/settings.ts";
import { sendSpotFreedMail } from "../../shared/events.ts";

// Link „Nie mogę przyjść — zwalniam miejsce" z e-maili: oznacza zapis jako
// Wypisany i awansuje pierwszą osobę z listy rezerwowej (z e-mailem).

function htmlPage(title, lead) {
  return new Response(
    `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title}</title>
     <style>body{background:#0A0A0B;color:#E2E2E2;font-family:Georgia,serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
     .box{max-width:480px;text-align:center}.gold{color:#C9A24A;letter-spacing:4px;font-size:12px}h1{font-weight:400}
     .foot{color:#5C5C5E;font-size:11px;letter-spacing:2px;margin-top:40px}</style></head>
     <body><div class="box"><p class="gold">EXMORTIS</p><h1>${title}</h1><p>${lead}</p>
     <p class="foot">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export default async function (req) {
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    if (!token) {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }
    token = String(token || "").trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(token)) {
      return htmlPage("Nieprawidłowy link", "Ten link nie działa. Jeśli nie możesz przyjść, odpowiedz po prostu na e-mail ze spotkania.");
    }

    const base44 = createClientFromRequest(req);
    await loadAppUrl(base44);
    // Zapis z kupionym biletem nie zwalnia miejsca jednym kliknięciem — bilet jest opłacony (zwroty ustalamy mailowo).
    const paid = await runSql(base44, `SELECT 1 FROM public.registrations WHERE cancel_token = ${escStr(token)} AND source = 'bilet' LIMIT 1`, true).catch(() => []);
    if (paid?.length) {
      return htmlPage("Masz bilet na to spotkanie", "Twój bilet jest ważny. Jeśli nie możesz przyjść, odpowiedz na e-mail z biletem — ustalimy, co dalej. Bilet możesz też przekazać innej osobie.");
    }
    const freed = await runSql(
      base44,
      `UPDATE public.registrations SET status = 'Wypisany'
       WHERE cancel_token = ${escStr(token)} AND status <> 'Wypisany'
       RETURNING event_id, first_name`
    );

    if (!freed || freed.length === 0) {
      return htmlPage("To miejsce jest już zwolnione", "Nie musisz nic robić — zapis został już wcześniej anulowany.");
    }

    const eventId = freed[0].event_id;
    const evRows = await runSql(
      base44,
      `SELECT id, title, subtitle, format, start_datetime, duration_minutes, location, join_link, external_url
       FROM public.events WHERE id = ${escStr(eventId)}`,
      true
    );
    const ev = evRows && evRows[0];

    // Awans pierwszej osoby z listy rezerwowej.
    const promoted = await runSql(
      base44,
      `UPDATE public.registrations SET status = 'Zapisany'
       WHERE id = (
         SELECT id FROM public.registrations
         WHERE event_id = ${escStr(eventId)} AND status = 'Lista rezerwowa'
         ORDER BY created_at ASC LIMIT 1
       )
       RETURNING id, first_name, email, cancel_token`
    );

    if (ev && promoted && promoted.length > 0) {
      waitUntil(sendSpotFreedMail(base44, ev, promoted[0]).catch(() => {}));
    }

    return htmlPage(
      "Miejsce zwolnione",
      `Dziękuję, ${freed[0].first_name}. Twoje miejsce na «${ev ? ev.title : "spotkanie"}» zostało zwolnione${
        promoted && promoted.length > 0 ? " i przeszło na pierwszą osobę z listy rezerwowej" : ""
      }.`
    );
  } catch (error) {
    return htmlPage("Coś nie zadziałało", "Nie udało się zwolnić miejsca. Odpowiedz po prostu na e-mail ze spotkaniem, a zajmę się tym.");
  }
}