import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { getSetting } from "../../shared/settings.ts";
import { cleanFirma, PREMIERA_DEFAULT } from "../../shared/firma.ts";

// Publiczne ustawienia strony: dane firmy i tryb przedpremierowy.
// Lista kont z dostępem przedpremierowym nie wychodzi na zewnątrz — tylko „czy ja mam dostęp”.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const [firma, premiera, me] = await Promise.all([
      getSetting(base44, "firma").catch(() => null),
      getSetting(base44, "premiera").catch(() => null),
      base44.auth.me().catch(() => null),
    ]);
    const { dostep = [], ...p } = { ...PREMIERA_DEFAULT, ...(premiera || {}) };
    const email = String(me?.email || "").toLowerCase();
    const ja_dostep = !!email && dostep.some((x) => x.email === email && Date.parse(x.do) > Date.now());
    return Response.json({ firma: cleanFirma(firma), premiera: p, ja_dostep, now: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}