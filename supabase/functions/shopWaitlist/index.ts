import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, emailField, textField, clientIp } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";
import { loadAppUrl } from "../_shared/settings.ts";
import { sendMail } from "../_shared/smtp.ts";
import { ensureWaitlistCols, waitlistToken, waitlistUnsubUrl, waitlistJoinHtml, waitlistPage } from "../_shared/waitlist.ts";

// Publiczny zapis na listę oczekujących przy produkcie "wkrótce" (limit 10 zapisów na godzinę z jednego IP).
// Nowy zapis dostaje jeden mail potwierdzający z linkiem wypisania. Powiadomienie o premierze wysyła
// administrator (Panel → Skarbiec → „Lista oczekujących”) albo zapis produktu przy zmianie na „dostępny”.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // Wypisanie z listy jednym kliknięciem z maila (GET) albo z aplikacji (POST).
    if (String(url.searchParams.get("action") || body.action || "") === "unsubscribe") {
      const token = String(url.searchParams.get("t") || body.token || "").trim().toLowerCase();
      if (!/^[0-9a-f]{16,64}$/.test(token)) {
        return waitlistPage("Nieprawidłowy link", "Ten link nie działa. Jeśli nie chcesz wiadomości o premierze, odpowiedz po prostu na ostatni e-mail.");
      }
      await ensureWaitlistCols(base44);
      const gone = await runSql(base44, `DELETE FROM public.waitlist WHERE unsubscribe_token = ${escStr(token)} RETURNING id`);
      if (!gone || gone.length === 0) {
        return waitlistPage("Ten adres nie jest na liście", "Nie ma czego wypisywać — ten adres nie jest już na liście oczekujących.");
      }
      return waitlistPage("Wypisano z listy oczekujących", "Ten adres nie dostanie już wiadomości o premierze. Jeśli zmienisz zdanie, możesz zapisać się ponownie na stronie produktu.");
    }

    let email, firstName, productId;
    try {
      email = emailField(body);
      firstName = textField(body, "first_name", { max: 200, required: false });
      productId = textField(body, "product_id", { max: 100 });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    if (!(await ipAllowed(base44, clientIp(req), "lista", 10, 3600000, productId))) return Response.json({ error: TOO_MANY }, { status: 429 });

    await ensureWaitlistCols(base44);
    const token = waitlistToken();
    // RETURNING: potwierdzenie idzie tylko wtedy, gdy wiersz naprawdę powstał (ON CONFLICT nic nie dodał = bez maila).
    const added = await runSql(
      base44,
      `INSERT INTO public.waitlist (email, first_name, product_id, unsubscribe_token)
       SELECT ${escStr(email)}, ${firstName === null ? "NULL" : escStr(firstName)}, ${escStr(productId)}, ${escStr(token)}
       WHERE EXISTS (SELECT 1 FROM public.products WHERE id::text = ${escStr(productId)} AND active = TRUE)
       ON CONFLICT (email, product_id) DO NOTHING
       RETURNING id, first_name`
    );

    if (added && added.length > 0) {
      try {
        const [p] = await runSql(base44, `SELECT name, slug FROM public.products WHERE id::text = ${escStr(productId)}`, true);
        if (p) {
          const appUrl = await loadAppUrl(base44);
          await sendMail(base44, {
            to: email,
            subject: `EXMORTIS · Jesteś na liście: „${p.name}”`,
            html: waitlistJoinHtml(p, added[0].first_name ?? firstName, `${appUrl}/skarbiec/${encodeURIComponent(p.slug)}`, waitlistUnsubUrl(appUrl, token)),
            kind: "lista_potwierdzenie_produkt",
            ref: productId,
          });
        }
      } catch (e) {
        // Błąd poczty nie blokuje zapisu — wiersz zostaje na liście.
        console.error("lista: potwierdzenie", String(e?.message || e).slice(0, 200));
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
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