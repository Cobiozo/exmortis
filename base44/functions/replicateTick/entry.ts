import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import { replicateFull, replicateDelta, replikacjaStatus } from "../../shared/replicate.ts";

// Replikacja danych do kopii w Supabase (tabele exm_*).
// Przyrost co 5 minut (Zadania cykliczne → ten tick, token zadania z mb_settings).
// Pełna kopia (action: "full") tylko z sesji administratora — jednorazowo, z wznawianiem.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const me = await base44.auth.me().catch(() => null);
    const admin = me?.role === "admin";

    let tokenOk = false;
    if (typeof body.tick_token === "string" && body.tick_token) {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows && rows[0] ? String(rows[0].tick_token || "") : "";
      tokenOk = !!stored && safeEqual(String(body.tick_token), stored);
    }
    if (!admin && !tokenOk) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (body.action === "full") {
      if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
      return Response.json(await replicateFull(base44, { only: body.entity }));
    }
    if (body.action === "status") return Response.json(await replikacjaStatus(base44));
    return Response.json(await replicateDelta(base44, {}));
  } catch (error) {
    console.error("replicateTick:", String(error?.message || error).slice(0, 300));
    return Response.json({ error: "Błąd replikacji" }, { status: 500 });
  }
}