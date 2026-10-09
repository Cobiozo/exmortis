import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { getSetting } from "../../shared/settings.ts";
import { cleanFirma, PREMIERA_DEFAULT } from "../../shared/firma.ts";

// Publiczne ustawienia strony: dane firmy (tylko wypełnione pola pokazuje frontend) i tryb przedpremierowy.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const [firma, premiera] = await Promise.all([
      getSetting(base44, "firma").catch(() => null),
      getSetting(base44, "premiera").catch(() => null),
    ]);
    return Response.json({ firma: cleanFirma(firma), premiera: { ...PREMIERA_DEFAULT, ...(premiera || {}) }, now: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}