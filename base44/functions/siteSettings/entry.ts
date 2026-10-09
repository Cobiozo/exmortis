import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { getSettingsFast } from "../../shared/settings.ts";
import { getSnap } from "../../shared/snapshot.ts";
import { cleanFirma, PREMIERA_DEFAULT } from "../../shared/firma.ts";

// Publiczne ustawienia strony: dane firmy i tryb przedpremierowy.
// Jedno zapytanie (pamięć 60 s); konto sprawdzane tylko, gdy żądanie ma token.
// Lista kont z dostępem przedpremierowym nie wychodzi na zewnątrz — tylko „czy ja mam dostęp”.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const hasToken = !!req.headers.get("authorization");
    const [s, me] = await Promise.all([
      getSnap(base44, "settings:firma,premiera", () => getSettingsFast(base44, ["firma", "premiera"])) as Promise<Record<string, any>>,
      hasToken ? base44.auth.me().catch(() => null) : null,
    ]);
    const { dostep = [], ...p } = { ...PREMIERA_DEFAULT, ...(s.premiera || {}) };
    const email = String(me?.email || "").toLowerCase();
    const ja_dostep = !!email && dostep.some((x) => x.email === email && Date.parse(x.do) > Date.now());
    return Response.json({ firma: cleanFirma(s.firma), premiera: p, ja_dostep, now: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}