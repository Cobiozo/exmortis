import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { clientIp } from "../../shared/supabase.ts";

// Publiczny zapis błędów przeglądarki (ClientError) z limitem: 10 zgłoszeń na godzinę z jednego IP.
// Limit liczebny w samej encji ClientError (pole ip) — bez rejestru SecurityLog.
// Zapis idzie przez tę funkcję (rola serwisowa); bezpośredni zapis SDK jest zablokowany regułą RLS.
const MAX_GODZINA = 10;
const cut = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const message = cut(body.message, 500).trim();
    if (!message) return Response.json({ error: "Brak treści błędu" }, { status: 400 });
    const url = cut(body.url, 500);
    const stack = cut(body.stack, 2000);
    const browser = cut(body.browser, 300);
    const at = typeof body.at === "string" && body.at.length < 40 ? body.at : new Date().toISOString();

    const ip = clientIp(req);
    if (ip && ip !== "brak") {
      const since = new Date(Date.now() - 3600000).toISOString();
      const recent = await base44.asServiceRole.entities.ClientError
        .filter({ ip, created_date: { $gte: since } }, "-created_date", MAX_GODZINA).catch(() => []);
      const n = Array.isArray(recent) ? recent.length : (recent?.items || []).length;
      if (n >= MAX_GODZINA) {
        // Cicho odrzucamy — klient nie ma z tego powodu przestać działać.
        return Response.json({ ok: true, odrzucone: true });
      }
    }

    await base44.asServiceRole.entities.ClientError.create({ url, message, stack, browser, at, ip });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}