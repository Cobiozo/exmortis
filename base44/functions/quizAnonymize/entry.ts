// Jednorazowe zadania wykonane 5.11.2026 (decyzje właściciela): czyszczenie quiz_result i maili testu,
// grupa „Wszystkie konta”, licznik ukończeń testu, reguła potwierdzonych adresów.
// 5.11.2026 19:30 — INSPEKCJA PayU (tylko odczyt, zlecenie właściciela): struktura public.orders, RLS, polityki,
// ograniczenia, liczby zamówień wg statusu (bez danych osób), Edge Functions i nazwy sekretów projektu
// fqhvxhnbeyvwubpnuzxe, metadane ustawień PayU (bez wartości kluczy), zadania pg_cron, błędy PayU z logów.
// Nie przyjmuje parametrów i niczego nie zapisuje. Po użyciu funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const REF = "fqhvxhnbeyvwubpnuzxe";
const API = `https://api.supabase.com/v1/projects/${REF}`;

Deno.serve(async (req) => {
  const out: Record<string, unknown> = {};
  try {
    const base44 = createClientFromRequest(req);
    const q = async (name: string, sql: string) => {
      try { out[name] = await runSql(base44, sql, true); } catch (e) { out[name] = { blad: String(e?.message || e).slice(0, 300) }; }
    };
    await q("orders_kolumny", `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position`);
    await q("orders_ograniczenia", `SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.orders'::regclass`);
    await q("orders_indeksy", `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='orders'`);
    await q("orders_rls", `SELECT relrowsecurity AS rls, relforcerowsecurity AS force_rls FROM pg_class WHERE oid='public.orders'::regclass`);
    await q("orders_polityki", `SELECT policyname, cmd, roles::text, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='orders'`);
    await q("orders_uprawnienia", `SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS prawa FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='orders' GROUP BY grantee ORDER BY grantee`);
    await q("orders_wyzwalacze", `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND NOT tgisinternal`);
    await q("orders_statusy", `SELECT status, count(*)::int AS n, min(created_date)::date AS od, max(created_date)::date AS do,
      count(*) FILTER (WHERE COALESCE(payu_order_id,'')='')::int AS bez_payu_id,
      count(*) FILTER (WHERE payu_order_id LIKE 'FREE-%')::int AS free
      FROM public.orders GROUP BY status ORDER BY status`);
    await q("orders_duplikaty_payu_id", `SELECT count(*)::int AS n FROM (SELECT payu_order_id FROM public.orders WHERE COALESCE(payu_order_id,'')<>''
      GROUP BY payu_order_id HAVING count(*)>1) d`);
    await q("orders_rozmiar", `SELECT pg_size_pretty(pg_total_relation_size('public.orders')) AS rozmiar, (SELECT count(*)::int FROM public.orders) AS wiersze`);
    await q("payu_events", `SELECT to_regclass('public.payu_events')::text AS tabela`);
    await q("exm_exec_sql", `SELECT p.proname, p.prosecdef AS security_definer, r.rolname AS wlasciciel,
      left(pg_get_functiondef(p.oid), 900) AS poczatek,
      (SELECT string_agg(grantee, ',') FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name=p.proname) AS kto_wykonuje
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname='exm_exec_sql'`);
    await q("cron", `SELECT CASE WHEN to_regclass('cron.job') IS NULL THEN 'brak pg_cron' ELSE 'jest' END AS pg_cron`);
    await q("cron_zadania", `SELECT jobid, jobname, schedule, active, left(command, 160) AS polecenie FROM cron.job ORDER BY jobid`);
    await q("cron_ostatnie", `SELECT jobid, status, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5`);
    await q("payu_ustawienia", `SELECT value->>'env' AS env, (value->>'posId') ~ '^[0-9]+$' AS pos_cyfry,
      length(value->>'posId') AS pos_dl, (value->>'clientId') = (value->>'posId') AS client_rowny_pos,
      length(value->>'clientSecret') AS secret_dl, length(value->>'secondKey') AS second_dl, updated_date
      FROM public.app_settings WHERE key='payu'`);
    await q("app_url", `SELECT value->>'url' AS url FROM public.app_settings WHERE key='app'`);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    const api = async (name: string, path: string, map?: (j: unknown) => unknown) => {
      try {
        const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
        const j = await r.json().catch(() => null);
        out[name] = r.ok ? (map ? map(j) : j) : { status: r.status, blad: JSON.stringify(j).slice(0, 300) };
      } catch (e) { out[name] = { blad: String(e?.message || e).slice(0, 200) }; }
    };
    const WANT = ["payuCreateOrder", "payuNotification", "adminSettings", "cmsScheduled", "cronTick", "orderFree", "myAccount"];
    await api("edge_functions", "/functions", (j) => (Array.isArray(j) ? j : []).filter((f: any) => WANT.includes(f.slug))
      .map((f: any) => ({ slug: f.slug, version: f.version, status: f.status, verify_jwt: f.verify_jwt,
        updated: f.updated_at ? new Date(f.updated_at).toISOString() : null, import_map: f.import_map, entrypoint: f.entrypoint_path })));
    await api("edge_functions_liczba", "/functions", (j) => (Array.isArray(j) ? j.length : null));
    await api("sekrety_nazwy", "/secrets", (j) => (Array.isArray(j) ? j.map((s: any) => s.name).sort() : j));
    // Błędy PayU z ostatnich 24 h (bez adresów e-mail).
    try {
      const end = new Date(), start = new Date(Date.now() - 24 * 3600000);
      const sql = `select datetime(timestamp) as t, event_message as m from function_logs where regexp_contains(event_message, '(?i)payu|error:') order by timestamp desc limit 25`;
      const r = await fetch(`${API}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => null);
      out.logi_payu = { status: r.status, wiersze: (j?.result || []).map((x: any) => ({ t: x.t, m: String(x.m || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]").slice(0, 240) })), blad: j?.error ? JSON.stringify(j.error).slice(0, 200) : null };
    } catch (e) { out.logi_payu = { blad: String(e?.message || e).slice(0, 200) }; }
    return Response.json({ ok: true, ...out });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 300), ...out }, { status: 500 });
  }
});
