// TYMCZASOWA INSPEKCJA PayU — 5.11.2026, etap 1 zatwierdzony przez właściciela (tylko odczyt).
// Autoryzacja: nagłówek X-Exm-Session = token sesji Supabase zalogowanego ADMINISTRATORA (rola admin w exm_user).
// Token sprawdzany w Supabase Auth (/auth/v1/user), rola w bazie. // Bez ważnej sesji administratora funkcja kończy się 401 i nie wykonuje żadnego zapytania.
// Wszystkie zapytania SQL idą trybem read-only Management API do projektu fqhvxhnbeyvwubpnuzxe.
// Zwraca wyłącznie strukturę, liczby i skrócone numery zamówień — bez imion, adresów e-mail i treści maili.
// Po inspekcji funkcja wraca do 410.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const REF = "fqhvxhnbeyvwubpnuzxe";
const API = `https://api.supabase.com/v1/projects/${REF}`;

const SUPA = "https://fqhvxhnbeyvwubpnuzxe.supabase.co";
// Klucz publiczny (anon) — ten sam co w .env strony; sam nie daje dostępu do danych.
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxaHZ4aG5iZXl2d3VicG51enhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMzgyMjMsImV4cCI6MjEwNDYxNDIyM30.-FaXBLNrtt8Uu_tD2bY_7cy8Jdyt4l0YIdqXmSHQXr0";

async function adminOk(base44, token: string) {
  if (!/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return false;
  const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!r || !r.ok) return false;
  const u = await r.json().catch(() => null);
  const email = String(u?.email || "").trim().toLowerCase();
  if (!email || !u?.email_confirmed_at) return false;
  const rows = await runSql(base44, `SELECT 1 FROM public.exm_user WHERE lower(data->>'email') = '${email.replace(/'/g, "''")}' AND data->>'role' = 'admin' LIMIT 1`, true).catch(() => []);
  return Array.isArray(rows) && rows.length === 1;
}

const redact = (s: unknown) => String(s ?? "")
  .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[JWT]")
  .replace(/(bearer\s+)[\w.\-]+/gi, "$1[UKRYTE]")
  .replace(/("?(apikey|authorization|x-[\w-]*key|token|secret)"?\s*[:=]\s*"?)[^"',\s)]+/gi, "$1[UKRYTE]")
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]");

Deno.serve(async (req) => {
  const out: Record<string, unknown> = {};
  try {
    const base44 = createClientFromRequest(req);
    if (!(await adminOk(base44, req.headers.get("x-exm-session") || ""))) return Response.json({ error: "Brak autoryzacji" }, { status: 401 });
    const q = async (name: string, sql: string) => {
      try { out[name] = await runSql(base44, sql, true); } catch (e) { out[name] = { blad: redact(e?.message || e).slice(0, 300) }; }
    };

    // ---- A. tożsamość i struktura ----
    await q("polaczenie", `SELECT current_database() AS baza, current_user AS rola, version() AS wersja,
      (SELECT setting FROM pg_settings WHERE name='server_version') AS pg`);
    await q("orders_kolumny", `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='orders' ORDER BY ordinal_position`);
    await q("orders_ograniczenia", `SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.orders'::regclass`);
    await q("orders_indeksy", `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='orders'`);
    await q("orders_rls", `SELECT relrowsecurity AS rls, relforcerowsecurity AS force_rls, pg_get_userbyid(relowner) AS wlasciciel
      FROM pg_class WHERE oid='public.orders'::regclass`);
    await q("orders_polityki", `SELECT policyname, permissive, cmd, roles::text, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='orders'`);
    await q("orders_uprawnienia", `SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS prawa FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name='orders' GROUP BY grantee ORDER BY grantee`);
    await q("orders_wyzwalacze", `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgrelid='public.orders'::regclass AND NOT tgisinternal`);
    await q("orders_zalezne_widoki", `SELECT DISTINCT n.nspname || '.' || c.relname AS widok FROM pg_depend d
      JOIN pg_rewrite r ON r.oid = d.objid JOIN pg_class c ON c.oid = r.ev_class JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE d.refobjid = 'public.orders'::regclass AND c.oid <> 'public.orders'::regclass`);
    await q("orders_rozmiar", `SELECT pg_size_pretty(pg_total_relation_size('public.orders')) AS rozmiar, (SELECT count(*)::int FROM public.orders) AS wiersze`);
    await q("orders_statusy", `SELECT status, count(*)::int AS n, min(created_date)::date AS od, max(created_date)::date AS do,
      count(*) FILTER (WHERE COALESCE(payu_order_id,'')='')::int AS bez_payu_id,
      count(*) FILTER (WHERE payu_order_id LIKE 'FREE-%')::int AS free,
      count(*) FILTER (WHERE COALESCE(total,0) > 0)::int AS platne
      FROM public.orders GROUP BY status ORDER BY status`);
    await q("orders_duplikaty_payu_id", `SELECT count(*)::int AS n FROM (SELECT payu_order_id FROM public.orders WHERE COALESCE(payu_order_id,'')<>''
      GROUP BY payu_order_id HAVING count(*)>1) d`);
    await q("aktywnosc", `SELECT count(*) FILTER (WHERE state <> 'idle')::int AS aktywne,
      count(*) FILTER (WHERE state <> 'idle' AND xact_start < now() - interval '1 minute')::int AS dlugie_transakcje,
      (SELECT count(*)::int FROM pg_locks l WHERE l.relation = 'public.orders'::regclass) AS blokady_orders
      FROM pg_stat_activity WHERE datname = current_database()`);

    // Struktury zakładane dotąd w trakcie zakupów (DDL w locie) — co już istnieje.
    await q("struktury_tabele", `SELECT t AS tabela, to_regclass(t)::text IS NOT NULL AS istnieje,
      CASE WHEN to_regclass(t) IS NULL THEN NULL ELSE (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass(t)) END AS rls
      FROM unnest(ARRAY['public.payu_events','public.discount_reservations','public.event_tickets','public.order_refunds',
        'public.exm_access','public.exm_consent','public.exm_discountcode','public.exm_mailqueue','public.exm_subscriber',
        'public.products','public.events','public.app_settings']) AS t`);
    await q("struktury_kolumny", `SELECT c.t AS kolumna, EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=split_part(c.t,'.',1) AND column_name=split_part(c.t,'.',2)) AS istnieje
      FROM unnest(ARRAY['orders.invoice','orders.discount_code','orders.refunded_total','orders.reminded_at',
        'orders.invoice_id','orders.invoice_number','orders.invoice_url','orders.invoice_at','orders.invoice_error',
        'orders.payu_status','orders.redirect_uri','orders.fulfilled_at','orders.fulfill_lock_at','orders.fulfill_tries','orders.fulfill_error',
        'order_refunds.correction_id','order_refunds.correction_number','order_refunds.correction_url','order_refunds.correction_error',
        'events.tickets','events.ticket_template']) AS c(t)`);
    await q("struktury_funkcje", `SELECT p.proname, p.prosecdef AS security_definer, pg_get_userbyid(p.proowner) AS wlasciciel,
      has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('exm_reserve_code','exm_exec_sql')`);
    await q("exm_exec_sql_poczatek", `SELECT left(regexp_replace(pg_get_functiondef(p.oid), '\\s+', ' ', 'g'), 700) AS def
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='exm_exec_sql'`);
    await q("schemat_backup", `SELECT n.nspname, has_schema_privilege('anon', n.oid, 'USAGE') AS anon_usage,
      (SELECT count(*)::int FROM pg_class c WHERE c.relnamespace = n.oid AND c.relkind='r') AS tabele
      FROM pg_namespace n WHERE n.nspname='backup'`);

    // ---- B. historyczne zamówienia COMPLETED — dowody realizacji (bez danych osób) ----
    // Wszystkie zamówienia COMPLETED, partiami po BATCH (stała kolejność: data, id).
    {
      const BATCH = 400;
      const all: any[] = [];
      let partie = 0, blad: string | null = null;
      try {
        const total = await runSql(base44, `SELECT count(*)::int AS n FROM public.orders WHERE status='COMPLETED'`, true);
        const n = Number(total?.[0]?.n) || 0;
        for (let offset = 0; offset < n; offset += BATCH) {
          const rows = await runSql(base44, `WITH o AS (
        SELECT id, created_date, total, payu_order_id, items, to_jsonb(orders)->'invoice' AS inv,
               to_jsonb(orders)->>'invoice_number' AS inv_no
        FROM public.orders WHERE status='COMPLETED' ORDER BY created_date DESC, id LIMIT ${BATCH} OFFSET ${offset}),
      it AS (SELECT o.id AS oid, i->>'product_id' AS pid, COALESCE((i->>'quantity')::int, 1) AS q, i->>'kind' AS kind, i->>'event_id' AS ev
        FROM o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.items)='array' THEN o.items ELSE '[]'::jsonb END) i),
      typ AS (SELECT it.*, p.product_type FROM it LEFT JOIN public.products p ON p.id::text = it.pid)
      SELECT upper(left(o.id, 8)) AS nr, o.created_date::date AS dzien, o.total::float8 AS kwota,
        CASE WHEN o.payu_order_id LIKE 'FREE-%' THEN 'bez_platnosci' ELSE 'payu' END AS kanal,
        (SELECT string_agg(DISTINCT COALESCE(product_type, CASE WHEN kind='bilet' THEN 'bilet' ELSE '?' END), ',') FROM typ WHERE typ.oid=o.id) AS typy,
        (SELECT count(*)::int FROM typ WHERE typ.oid=o.id AND product_type IN ('pdf','audio','wideo','kurs','pakiet')) AS cyfrowe_pozycje,
        (SELECT count(*)::int FROM public.exm_access a WHERE a.data->'history' @> jsonb_build_array(jsonb_build_object('order_id', o.id))) AS dostepy,
        (SELECT COALESCE(sum(q),0)::int FROM typ WHERE typ.oid=o.id AND kind='bilet') AS bilety_oczekiwane,
        (SELECT count(*)::int FROM public.event_tickets t WHERE t.order_id = o.id) AS bilety,
        (SELECT COALESCE(sum(q),0)::int FROM typ WHERE typ.oid=o.id AND product_type='karta') AS karty_oczekiwane,
        (SELECT count(*)::int FROM public.exm_discountcode d WHERE d.data->>'opis' ILIKE '%zamówienie ' || upper(left(o.id, 8)) || '%') AS karty,
        (SELECT string_agg(m.data->>'status', ',') FROM public.exm_mailqueue m WHERE m.data->>'kind'='zamowienie' AND m.data->>'ref'=o.id) AS mail,
        (o.inv IS NOT NULL AND jsonb_typeof(o.inv)='object') AS faktura_chciana, (o.inv_no IS NOT NULL) AS faktura_wystawiona
      FROM o ORDER BY o.created_date DESC`, true);
          all.push(...(rows || []));
          partie++;
        }
        out.realizacje_historyczne = { completed_w_bazie: n, sprawdzone: all.length, partie, zamowienia: all };
      } catch (e) { blad = redact(e?.message || e).slice(0, 300); out.realizacje_historyczne = { blad, sprawdzone: all.length, partie }; }
    }

    // ---- C. pg_cron / pg_net ----
    await q("rozszerzenia", `SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron','pg_net','pgsodium','supabase_vault')`);
    try {
      const jobs = await runSql(base44, `SELECT jobid, jobname, schedule, active, database, username, command FROM cron.job ORDER BY jobid`, true);
      out.cron_zadania = (jobs || []).map((j: any) => ({ ...j, command: redact(j.command).slice(0, 400) }));
    } catch (e) { out.cron_zadania = { blad: redact(e?.message || e).slice(0, 300) }; }
    try {
      const runs = await runSql(base44, `SELECT jobid, max(start_time) AS ostatni_start,
          count(*) FILTER (WHERE start_time > now() - interval '30 days')::int AS przebiegi_30d,
          count(*) FILTER (WHERE status <> 'succeeded' AND start_time > now() - interval '30 days')::int AS bledy_30d,
          max(start_time) FILTER (WHERE status = 'succeeded') AS ostatni_sukces,
          (array_agg(status ORDER BY start_time DESC))[1] AS ostatni_status,
          (array_agg(left(return_message, 300) ORDER BY start_time DESC))[1] AS ostatni_komunikat
        FROM cron.job_run_details GROUP BY jobid ORDER BY jobid`, true);
      out.cron_przebiegi = (runs || []).map((r: any) => ({ ...r, ostatni_komunikat: redact(r.ostatni_komunikat) }));
    } catch (e) { out.cron_przebiegi = { blad: redact(e?.message || e).slice(0, 300) }; }
    await q("cron_wokol_22_10", `SELECT jobid, date_trunc('day', start_time)::date AS dzien, count(*)::int AS n,
        count(*) FILTER (WHERE status <> 'succeeded')::int AS bledy
      FROM cron.job_run_details WHERE start_time BETWEEN '2026-10-19' AND '2026-10-26' GROUP BY 1, 2 ORDER BY 1, 2`);
    try {
      const net = await runSql(base44, `SELECT status_code, count(*)::int AS n, max(created) AS ostatnio,
          (array_agg(left(COALESCE(error_msg, ''), 200) ORDER BY created DESC))[1] AS ostatni_blad
        FROM net._http_response WHERE created > now() - interval '30 days' GROUP BY status_code ORDER BY n DESC`, true);
      out.pg_net_odpowiedzi = (net || []).map((r: any) => ({ ...r, ostatni_blad: redact(r.ostatni_blad) }));
    } catch (e) { out.pg_net_odpowiedzi = { blad: redact(e?.message || e).slice(0, 300) }; }

    // ---- D. ustawienia PayU (bez wartości kluczy) ----
    await q("payu_ustawienia", `SELECT value->>'env' AS env, (value->>'posId') ~ '^[0-9]+$' AS pos_cyfry, length(value->>'posId') AS pos_dl,
      (value->>'clientId') = (value->>'posId') AS client_rowny_pos, length(value->>'clientSecret') AS secret_dl,
      length(value->>'secondKey') AS second_dl, updated_date FROM public.app_settings WHERE key='payu'`);
    await q("app_url", `SELECT value->>'url' AS url FROM public.app_settings WHERE key='app'`);

    // ---- E. Management API: funkcje, sekrety (nazwy), kopie zapasowe, logi ----
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("supabase");
    const api = async (name: string, path: string, map?: (j: any) => unknown) => {
      try {
        const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
        const j = await r.json().catch(() => null);
        out[name] = r.ok ? (map ? map(j) : j) : { status: r.status, blad: redact(JSON.stringify(j)).slice(0, 300) };
      } catch (e) { out[name] = { blad: redact(e?.message || e).slice(0, 200) }; }
    };
    const WANT = ["payuCreateOrder", "payuNotification", "adminSettings", "cmsScheduled", "adminOrders", "cronTick", "orderFree"];
    await api("edge_wybrane", "/functions", (j) => (Array.isArray(j) ? j : []).filter((f: any) => WANT.includes(f.slug))
      .map((f: any) => ({ slug: f.slug, version: f.version, status: f.status, verify_jwt: f.verify_jwt,
        zmieniona: f.updated_at ? new Date(f.updated_at).toISOString() : null, entrypoint: f.entrypoint_path, import_map: f.import_map })));
    await api("edge_wszystkie", "/functions", (j) => (Array.isArray(j) ? j.map((f: any) => `${f.slug}:${f.version}:${f.verify_jwt ? "jwt" : "public"}`) : null));
    await api("sekrety_nazwy", "/secrets", (j) => (Array.isArray(j) ? j.map((s: any) => s.name).sort() : null));
    await api("kopie_zapasowe", "/database/backups", (j) => ({ region: j?.region, pitr: j?.pitr_enabled, walg: j?.walg_enabled,
      ostatnie: (j?.backups || []).slice(0, 5).map((b: any) => ({ kiedy: b.inserted_at, status: b.status, fizyczna: b.is_physical_backup })) }));
    await api("projekt", "", (j) => ({ nazwa: j?.name, status: j?.status, region: j?.region, plan: j?.subscription_tier ?? null }));
    try {
      const end = new Date(), start = new Date(Date.now() - 24 * 3600000);
      const sql = `select datetime(timestamp) as t, event_message as m from function_logs where regexp_contains(event_message, '(?i)payu|error:|edge:') order by timestamp desc limit 30`;
      const r = await fetch(`${API}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => null);
      out.logi_24h = { status: r.status, wiersze: (j?.result || []).map((x: any) => ({ t: x.t, m: redact(x.m).slice(0, 240) })), blad: j?.error ? redact(JSON.stringify(j.error)).slice(0, 200) : null };
    } catch (e) { out.logi_24h = { blad: redact(e?.message || e).slice(0, 200) }; }

    return Response.json({ ok: true, ...out });
  } catch (error) {
    return Response.json({ error: redact(error?.message || error).slice(0, 300), ...out }, { status: 500 });
  }
});
