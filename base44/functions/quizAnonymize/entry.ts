// Jednorazowe zadania wykonane 5.11.2026 (decyzje właściciela):
// - quiz_result: usunięte imię, e-mail, forma zwracania się i zdanie refleksji (16 z 27 wierszy);
// - kolejka poczty: treść 7 niewysłanych maili z wynikiem testu usunięta, status „pominiety”;
// - Biblioteka: reguła grup „wszystkie_konta” w bazie i grupa „Wszystkie konta” (Obok → Biblioteka);
// - anonimowy licznik ukończeń testu: tabela test_counts + funkcje test_done / test_stats;
// - audyt: „wszystkie_konta” tylko z potwierdzonym adresem (6 kont, 6 w grupie).
// 5.11.2026 17:20 — DIAGNOSTYKA płatności (zgłoszenie właściciela: „Nie udało się rozpocząć płatności”):
// zwraca wyłącznie metadane ustawień PayU (bez sekretów: tylko czy pola są wypełnione, ich długość i tryb)
// oraz komunikaty błędów funkcji z ostatnich 3 godzin. Po użyciu funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const REF = "fqhvxhnbeyvwubpnuzxe";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rows = await runSql(base44, `SELECT value, updated_date FROM public.app_settings WHERE key = 'payu'`, true);
    const v = rows?.[0]?.value || {};
    const meta = (s) => ({ jest: !!String(s || "").trim(), dl: String(s || "").trim().length, spacje: String(s || "") !== String(s || "").trim(), cyfry: /^\d+$/.test(String(s || "").trim()) });
    const payu = {
      env: v.env ?? null, zmieniono: rows?.[0]?.updated_date ?? null,
      posId: meta(v.posId), clientId: meta(v.clientId), clientSecret: meta(v.clientSecret), secondKey: meta(v.secondKey),
      clientId_rowny_posId: String(v.clientId || "").trim() === String(v.posId || "").trim(),
      klucze: Object.keys(v),
    };
    let logs = null;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
      const end = new Date(), start = new Date(Date.now() - 3 * 3600000);
      const sql = `select datetime(timestamp) as t, event_message as m from function_logs where regexp_contains(event_message, 'error|PayU|payu') order by timestamp desc limit 30`;
      const url = `https://api.supabase.com/v1/projects/${REF}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const j = await r.json().catch(() => null);
      logs = { status: r.status, rows: (j?.result || []).map((x) => ({ t: x.t, m: String(x.m || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]").slice(0, 300) })), error: j?.error ? String(JSON.stringify(j.error)).slice(0, 300) : null };
    } catch (e) {
      logs = { error: String(e?.message || e).slice(0, 200) };
    }
    return Response.json({ ok: true, payu, logs });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
});
