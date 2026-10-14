import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { clientIp } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";

// Strona /karta: karta podarunkowa po kluczu z linku (32 losowe znaki; klucz zna tylko kupujący i ten, komu go przekaże).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "");
    if (!/^[A-Za-z0-9]{24,64}$/.test(token)) return Response.json({ error: "Nie ma takiej karty" }, { status: 404 });
    // Klucz jest losowy, ale publiczny adres nie może służyć do zgadywania seriami: 30 odczytów na godzinę z jednego połączenia.
    if (!(await ipAllowed(base44, clientIp(req), "karta", 30, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
    const c = (await base44.asServiceRole.entities.DiscountCode.filter({ gift_token: token }))[0];
    if (!c) return Response.json({ error: "Nie ma takiej karty" }, { status: 404 });
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
    return Response.json({
      value: c.value, code: c.code, until: c.valid_until, to_name: c.gift_to || "", message: c.gift_message || "",
      used: (Number(c.uses) || 0) >= (Number(c.max_uses) || 1) || c.active === false,
      expired: !!c.valid_until && String(c.valid_until) < today,
    });
  } catch {
    return Response.json({ error: "Nie udało się wczytać karty" }, { status: 500 });
  }
}