import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, escStr, emailField } from "../../shared/supabase.ts";
import { KEEP, collectPerson, deletePerson, maskEmail } from "../../shared/gdpr.ts";
import { errorResponse } from "../../shared/errors.ts";

// RODO art. 15 i 17: znajdź / wyeksportuj / usuń dane osoby po e-mailu — w Supabase i w bazie aplikacji naraz.
export default async function (req) {
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