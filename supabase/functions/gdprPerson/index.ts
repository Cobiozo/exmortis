import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, emailField } from "../_shared/supabase.ts";
import { KEEP, collectPerson, deletePerson, maskEmail } from "../_shared/gdpr.ts";
import { errorResponse } from "../_shared/errors.ts";

// RODO art. 15 i 17: znajdź / wyeksportuj / usuń dane osoby po e-mailu — w Supabase i w bazie aplikacji naraz.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const email = emailField(body).toLowerCase();
    const sr = base44.asServiceRole.entities;
    const log = (akcja, zakres, liczba?) => sr.DataAccessLog.create({ kto: me.email, akcja, zakres, osoba: maskEmail(email), liczba, at: new Date().toISOString() });

    // Oznaczenie współpracy POWRÓT (decyduje o okresie przechowywania zgłoszenia).
    if (body.action === "powrot") {
      const col = body.field === "do" ? "wspolpraca_do" : "wspolpraca_od";
      await runSql(base44, `UPDATE public.powrot_applications SET ${col} = ${body.clear ? "NULL" : "current_date"} WHERE lower(email) = ${escStr(email)}`);
      await log("zmiana", `POWRÓT: ${col} ${body.clear ? "wyczyszczone" : "= dziś"}`);
      return Response.json({ ok: true });
    }

    const data = await collectPerson(base44, email);
    const { sbData, appData, account } = data;

    if (body.action === "find" || body.action === "export") {
      const summary = [
        ...Object.entries(sbData).map(([t, r]) => ({ baza: "Supabase", zbior: t, liczba: r.length, zostaje: KEEP.has(t) })),
        ...Object.entries(appData).map(([e, r]) => ({ baza: "Aplikacja", zbior: e, liczba: r.length, zostaje: KEEP.has(e) })),
        { baza: "Aplikacja", zbior: "Konto (User)", liczba: account.length, zostaje: false },
      ].filter((x) => x.liczba > 0);
      await log(body.action === "find" ? "otwarcie" : "eksport", body.action === "find" ? "Narzędzie RODO: wyszukanie" : "Narzędzie RODO: eksport JSON");
      if (body.action === "find") return Response.json({ email, summary, powrot: sbData.powrot_applications.map((r) => ({ id: r.id, created_date: r.created_date, wspolpraca_od: r.wspolpraca_od, wspolpraca_do: r.wspolpraca_do })) });
      return Response.json({ email, wygenerowano: new Date().toISOString(), supabase: sbData, aplikacja: appData, konto: account });
    }

    if (body.action === "delete") {
      if (String(body.confirm || "").toLowerCase() !== email) return Response.json({ error: "Wpisz adres, aby potwierdzić." }, { status: 400 });
      const r = await deletePerson(base44, email, data);
      await log("usuniecie", "Narzędzie RODO: usunięcie danych", r.total);
      return Response.json({ email, removed: r.removed, konto: r.konto, zostaje: [...KEEP] });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return errorResponse(error, "Nie udało się wykonać operacji. Spróbuj ponownie.");
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
