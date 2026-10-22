import { createClientFromRequest } from "../_shared/compat.ts";
import { emailField, clientIp } from "../_shared/supabase.ts";
import { mirrorRecord } from "../_shared/mirror.ts";
import { addSubscriber, confirmSubscriber, unsubscribeByToken } from "../_shared/newsletter.ts";
import { LISTY_TEXT } from "../_shared/registrations.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";
import { onboardingStop } from "../_shared/onboarding.ts";

// Publiczne zapisy do newslettera „Listy powrotu" + potwierdzenie z linku (double opt-in).
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (body.action === "confirm") {
      const res = await confirmSubscriber(base44, String(body.token || ""));
      if (!res) return Response.json({ ok: false });
      if (res.already) return Response.json({ ok: true, already: true });
      const row = res.row;
      const ip = clientIp(req);
      const made = await base44.asServiceRole.entities.Consent.create({
        email: row.email, kind: "newsletter", text: `${LISTY_TEXT} (potwierdzone kliknięciem linku z e-maila)`,
        source: "listy:potwierdzenie", given_at: new Date(row.confirmed_at).toISOString(), ip, status: "udzielona", doc_version: "1.1",
      });
      await mirrorRecord(base44, "Consent", made?.id);
      return Response.json({ ok: true });
    }
    // Wypis z listy (link w mailu kampanii) — bez logowania, po samym kluczu.
    if (body.action === "unsub") {
      const email = await unsubscribeByToken(base44, body.token);
      return Response.json({ ok: !!email });
    }
    // Wyłączenie listów prowadzących po zakupie (link w każdym z nich) — bez logowania, po kluczu.
    if (body.action === "drip_stop") {
      return Response.json({ ok: await onboardingStop(base44, body.token) });
    }
    const email = emailField(body);
    // Zapis wysyła mail z potwierdzeniem na podany adres — limit 5 na godzinę z jednego połączenia.
    if (!(await ipAllowed(base44, clientIp(req), "listy", 5, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
    await addSubscriber(base44, { email, name: body.name });
    return Response.json({ ok: true });
  } catch (error) {
    // Błąd walidacji formularza = 400 (wina danych), reszta = 500.
    const bad = /^(Brak pola|Pole .* jest zbyt długie|Niepoprawny adres e-mail)/.test(String(error?.message || ""));
    return Response.json({ error: error.message }, { status: bad ? 400 : 500 });
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
