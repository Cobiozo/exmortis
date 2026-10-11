// Rezerwacje 1:1 — schemat w Supabase (wyłącznie dodający). Uruchamiane przez bookingAdmin {action:"migrate"};
// każde polecenie jest powtarzalne (IF NOT EXISTS / OR REPLACE). KROK 1B: utwardzenie uprawnień i szyfrowania.

export const SCHEMA_SQL = `
-- ============ KROK 1B: utwardzenie bezpieczeństwa ============

-- 1) Kopie zapasowe poza schematem public (nie są wystawione w API), z RLS i odebranymi uprawnieniami.
CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA backup TO service_role;

DO $m$ BEGIN
  IF to_regclass('public.bk_backup_20261011_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bk_backup_20261011_events SET SCHEMA backup';
  END IF;
  IF to_regclass('public.bk_backup_20261011_registrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bk_backup_20261011_registrations SET SCHEMA backup';
  END IF;
END $m$;

DO $m$ DECLARE r text; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'backup' AND tablename LIKE 'bk_backup_%' LOOP
    EXECUTE format('ALTER TABLE backup.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON backup.%I FROM PUBLIC, anon, authenticated, service_role', r);
  END LOOP;
END $m$;

-- Rejestr kopii + automatyczne usunięcie po 30 dniach.
CREATE TABLE IF NOT EXISTS backup.bk_registry (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  drop_after timestamptz NOT NULL DEFAULT now() + interval '30 days',
  dropped_at timestamptz,
  note text
);
ALTER TABLE backup.bk_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON backup.bk_registry FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO backup.bk_registry (table_name)
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'backup' AND c.relname LIKE 'bk_backup_%'
ON CONFLICT (table_name) DO NOTHING;

CREATE OR REPLACE FUNCTION backup.purge_expired() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT table_name FROM backup.bk_registry WHERE dropped_at IS NULL AND drop_after < now() LOOP
    IF to_regclass('backup.' || quote_ident(r.table_name)) IS NOT NULL THEN
      EXECUTE format('DROP TABLE backup.%I', r.table_name);
    END IF;
    UPDATE backup.bk_registry SET dropped_at = now(), note = 'usunieto po 30 dniach' WHERE table_name = r.table_name;
    INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
      VALUES ('system', 'backup_usuniety', 'backup', r.table_name, 'kopia starsza niz 30 dni');
    n := n + 1;
  END LOOP;
  RETURN n;
END $p$;
REVOKE ALL ON FUNCTION backup.purge_expired() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION backup.purge_expired() TO service_role;

-- 2) Role i tabele modułu
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.bk_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'off' CHECK (mode IN ('off','admin','on')),
  min_notice_h int NOT NULL DEFAULT 24 CHECK (min_notice_h >= 24),
  daily_limit int NOT NULL DEFAULT 3 CHECK (daily_limit BETWEEN 1 AND 20),
  weekly_limit int CHECK (weekly_limit IS NULL OR weekly_limit BETWEEN 1 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bk_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.bk_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  description text CHECK (length(description) <= 2000),
  duration_min int NOT NULL CHECK (duration_min BETWEEN 10 AND 480),
  buffer_before int NOT NULL DEFAULT 0 CHECK (buffer_before BETWEEN 0 AND 240),
  buffer_after int NOT NULL DEFAULT 0 CHECK (buffer_after BETWEEN 0 AND 240),
  step_min int NOT NULL DEFAULT 30 CHECK (step_min BETWEEN 5 AND 240),
  horizon_days int NOT NULL DEFAULT 60 CHECK (horizon_days BETWEEN 1 AND 365),
  access text NOT NULL CHECK (access IN ('PUBLICZNY','PO_ZAKUPIE','PAKIET')),
  zoom_link text CHECK (zoom_link IS NULL OR zoom_link ~ '^https://'),
  questions jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(questions) = 'array'),
  change_window_h int NOT NULL DEFAULT 24 CHECK (change_window_h BETWEEN 0 AND 720),
  monthly_limit int CHECK (monthly_limit IS NULL OR monthly_limit BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT false,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.bk_types(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_local time NOT NULL,
  end_local time NOT NULL,
  CHECK (end_local > start_local)
);

CREATE TABLE IF NOT EXISTS public.bk_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('jednorazowa','calodniowa','powtarzalna')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  rep_weekday int CHECK (rep_weekday BETWEEN 1 AND 7),
  rep_from time,
  rep_to time,
  note text CHECK (length(note) <= 500),
  disabled boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (kind <> 'powtarzalna' OR (rep_weekday IS NOT NULL AND rep_from IS NOT NULL AND rep_to > rep_from))
);

CREATE TABLE IF NOT EXISTS public.bk_holidays (
  d date PRIMARY KEY,
  name text NOT NULL,
  blocked boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.bk_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  email_display text,
  type_id uuid NOT NULL REFERENCES public.bk_types(id),
  sessions_total int NOT NULL CHECK (sessions_total BETWEEN 1 AND 100),
  sessions_used int NOT NULL DEFAULT 0 CHECK (sessions_used >= 0),
  valid_until timestamptz NOT NULL,
  zoom_link text CHECK (zoom_link IS NULL OR zoom_link ~ '^https://'),
  min_gap_days int NOT NULL DEFAULT 0 CHECK (min_gap_days BETWEEN 0 AND 90),
  reschedule_limit int NOT NULL DEFAULT 2 CHECK (reschedule_limit BETWEEN 0 AND 20),
  payment_status text NOT NULL DEFAULT 'oplacony' CHECK (payment_status IN ('oplacony','oczekuje','zwrot')),
  source text NOT NULL CHECK (source IN ('reczny','zamowienie')),
  order_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sessions_used <= sessions_total)
);

CREATE TABLE IF NOT EXISTS public.bk_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.bk_types(id),
  package_id uuid REFERENCES public.bk_packages(id),
  user_id text,
  email text CHECK (length(email) <= 320),
  email_norm text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  first_name text CHECK (length(first_name) <= 120),
  is_public boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  busy tstzrange NOT NULL,
  client_tz text CHECK (length(client_tz) <= 64),
  status text NOT NULL DEFAULT 'POTWIERDZONA' CHECK (status IN ('POTWIERDZONA','ANULOWANA_KLIENT','ANULOWANA_ADMIN','PRZENIESIONA','ODBYLA_SIE','NIEOBECNOSC')),
  source text NOT NULL DEFAULT 'klient' CHECK (source IN ('klient','admin')),
  reschedule_count int NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),
  version int NOT NULL DEFAULT 0 CHECK (version >= 0),
  ics_uid text NOT NULL UNIQUE DEFAULT (gen_random_uuid()::text || '@exmortis'),
  idem_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (user_id IS NOT NULL OR email IS NOT NULL),
  CHECK (NOT isempty(busy) AND lower_inc(busy) AND NOT upper_inc(busy)),
  CHECK (lower(busy) <= starts_at AND upper(busy) >= ends_at),
  CONSTRAINT bk_no_overlap EXCLUDE USING gist (busy WITH &&) WHERE (status = 'POTWIERDZONA')
);
CREATE UNIQUE INDEX IF NOT EXISTS bk_one_public_per_email ON public.bk_bookings (type_id, email_norm)
  WHERE is_public AND status = 'POTWIERDZONA';
CREATE INDEX IF NOT EXISTS bk_bookings_starts ON public.bk_bookings (starts_at) WHERE status = 'POTWIERDZONA';

CREATE TABLE IF NOT EXISTS public.bk_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  answers jsonb,
  health_enc bytea,
  health_consent boolean NOT NULL DEFAULT false,
  keep boolean NOT NULL DEFAULT false,
  delete_after timestamptz NOT NULL,
  deleted_at timestamptz,
  CHECK (health_enc IS NULL OR health_consent)
);

CREATE TABLE IF NOT EXISTS public.bk_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bk_bookings(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('regulamin','odstapienie','zdrowie')),
  text_version text NOT NULL,
  text text NOT NULL,
  email_hmac text NOT NULL CHECK (email_hmac ~ '^[0-9a-f]{64}$'),
  ip_hmac text CHECK (ip_hmac ~ '^[0-9a-f]{64}$'),
  given_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose text NOT NULL CHECK (purpose IN ('zarzadzaj','zamowienie','zaproszenie','ical')),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  owner_user_id text,
  owner_email text,
  booking_id uuid REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.bk_packages(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bk_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  kind text NOT NULL,
  send_at timestamptz NOT NULL,
  idem_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'zaplanowane' CHECK (status IN ('zaplanowane','wyslane','pominiete','blad'))
);

CREATE TABLE IF NOT EXISTS public.bk_rate (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('ip','email')),
  key_hmac text NOT NULL CHECK (key_hmac ~ '^[0-9a-f]{64}$'),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bk_rate_key ON public.bk_rate (key_hmac, at);

CREATE TABLE IF NOT EXISTS public.bk_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  object_type text,
  object_id text,
  summary text CHECK (length(summary) <= 500),
  anonymized boolean NOT NULL DEFAULT false
);

-- 3) Rejestr działań: dopisywanie dozwolone dla wszystkich; zmiana/usunięcie wyłącznie przez rolę
--    bk_log_maint (NOLOGIN, właściciel funkcji anonimizującej i czyszczącej). Flagi sesji już nie ma —
--    nie da się jej ustawić z dowolnej sesji SQL.
DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bk_log_maint') THEN
    CREATE ROLE bk_log_maint NOLOGIN;
  END IF;
END $r$;
GRANT USAGE ON SCHEMA public TO bk_log_maint;
GRANT SELECT, UPDATE, DELETE ON public.bk_log TO bk_log_maint;

CREATE OR REPLACE FUNCTION public.bk_log_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $g$
BEGIN
  IF current_user = 'bk_log_maint' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'bk_log: wpisy mozna tylko dopisywac';
END $g$;
DROP TRIGGER IF EXISTS bk_log_no_change ON public.bk_log;
CREATE TRIGGER bk_log_no_change BEFORE UPDATE OR DELETE ON public.bk_log FOR EACH ROW EXECUTE FUNCTION public.bk_log_guard();
DROP TRIGGER IF EXISTS bk_log_no_truncate ON public.bk_log;
CREATE TRIGGER bk_log_no_truncate BEFORE TRUNCATE ON public.bk_log FOR EACH STATEMENT EXECUTE FUNCTION public.bk_log_guard();

CREATE OR REPLACE FUNCTION public.bk_log_anonymize(p_actor text, p_object_ids text[]) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $a$
DECLARE n int;
BEGIN
  UPDATE public.bk_log SET actor = CASE WHEN actor = p_actor THEN 'usunieto' ELSE actor END,
    summary = '[zanonimizowano]', anonymized = true
  WHERE (p_actor IS NOT NULL AND actor = p_actor) OR object_id = ANY(COALESCE(p_object_ids, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $a$;
ALTER FUNCTION public.bk_log_anonymize(text, text[]) OWNER TO bk_log_maint;

CREATE OR REPLACE FUNCTION public.bk_log_purge() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE n int;
BEGIN
  DELETE FROM public.bk_log WHERE at < now() - interval '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $p$;
ALTER FUNCTION public.bk_log_purge() OWNER TO bk_log_maint;

-- 4) Święta: Wielkanoc (Meeus/Jones/Butcher) + stałe i ruchome dni wolne, 2 lata do przodu.
CREATE OR REPLACE FUNCTION public.bk_easter(y int) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $e$
DECLARE a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
BEGIN
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  RETURN make_date(y, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
END $e$;

CREATE OR REPLACE FUNCTION public.bk_fill_holidays(p_years int DEFAULT 2) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $h$
DECLARE y int; ea date; n int := 0; c int;
BEGIN
  FOR y IN extract(year FROM now())::int .. extract(year FROM now())::int + p_years LOOP
    ea := public.bk_easter(y);
    INSERT INTO public.bk_holidays (d, name) VALUES
      (make_date(y,1,1), 'Nowy Rok'), (make_date(y,1,6), 'Trzech Króli'),
      (ea, 'Wielkanoc'), (ea + 1, 'Poniedziałek Wielkanocny'),
      (make_date(y,5,1), 'Święto Pracy'), (make_date(y,5,3), 'Święto Konstytucji 3 Maja'),
      (ea + 49, 'Zielone Świątki'), (ea + 60, 'Boże Ciało'),
      (make_date(y,8,15), 'Wniebowzięcie NMP'), (make_date(y,11,1), 'Wszystkich Świętych'),
      (make_date(y,11,11), 'Święto Niepodległości'), (make_date(y,12,24), 'Wigilia'),
      (make_date(y,12,25), 'Boże Narodzenie'), (make_date(y,12,26), 'Drugi dzień Bożego Narodzenia')
    ON CONFLICT (d) DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
  RETURN n;
END $h$;

-- 5) Wolne sloty jednego rodzaju (zakresy półotwarte [od, do)).
CREATE OR REPLACE FUNCTION public.bk_free_slots(p_type uuid, p_from timestamptz, p_to timestamptz,
  p_admin boolean DEFAULT false, p_ignore uuid DEFAULT NULL)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $f$
WITH s AS (SELECT * FROM public.bk_settings WHERE id = 1),
t AS (SELECT * FROM public.bk_types WHERE id = p_type),
days AS (
  SELECT g::date AS d FROM generate_series((p_from AT TIME ZONE 'Europe/Warsaw')::date,
    (p_to AT TIME ZONE 'Europe/Warsaw')::date, interval '1 day') g
),
cand AS (
  SELECT ((dy.d + h.start_local) AT TIME ZONE 'Europe/Warsaw') + (n * t.step_min) * interval '1 minute' AS st,
    ((dy.d + h.end_local) AT TIME ZONE 'Europe/Warsaw') AS win_end,
    t.duration_min, t.buffer_before, t.buffer_after, t.horizon_days, t.monthly_limit
  FROM days dy
  JOIN public.bk_hours h ON h.type_id = p_type AND h.weekday = extract(isodow FROM dy.d)::int
  CROSS JOIN t
  CROSS JOIN LATERAL generate_series(0, (extract(epoch FROM (h.end_local - h.start_local)) / 60 / t.step_min)::int) n
),
c AS (
  SELECT st, st + duration_min * interval '1 minute' AS en,
    tstzrange(st - buffer_before * interval '1 minute', st + (duration_min + buffer_after) * interval '1 minute', '[)') AS b,
    (st AT TIME ZONE 'Europe/Warsaw')::date AS ld, monthly_limit
  FROM cand, s
  WHERE st + duration_min * interval '1 minute' <= win_end
    AND st >= p_from AND st < p_to
    AND st >= now()
    AND st <= now() + horizon_days * interval '1 day'
    AND (p_admin OR st >= now() + s.min_notice_h * interval '1 hour')
)
SELECT c.st, c.en FROM c, s
WHERE NOT EXISTS (SELECT 1 FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.busy && c.b AND k.id IS DISTINCT FROM p_ignore)
  AND NOT EXISTS (SELECT 1 FROM public.bk_blocks x WHERE NOT x.disabled AND x.kind IN ('jednorazowa','calodniowa')
    AND tstzrange(x.starts_at, x.ends_at, '[)') && c.b)
  AND NOT EXISTS (SELECT 1 FROM public.bk_blocks x WHERE NOT x.disabled AND x.kind = 'powtarzalna'
    AND x.rep_weekday = extract(isodow FROM c.ld)::int
    AND c.ld BETWEEN (x.starts_at AT TIME ZONE 'Europe/Warsaw')::date AND (x.ends_at AT TIME ZONE 'Europe/Warsaw')::date
    AND tstzrange((c.ld + x.rep_from) AT TIME ZONE 'Europe/Warsaw', (c.ld + x.rep_to) AT TIME ZONE 'Europe/Warsaw', '[)') && c.b)
  AND NOT EXISTS (SELECT 1 FROM public.bk_holidays hd WHERE hd.blocked
    AND tstzrange(hd.d::timestamp AT TIME ZONE 'Europe/Warsaw', (hd.d + 1)::timestamp AT TIME ZONE 'Europe/Warsaw', '[)') && c.b)
  AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.status = 'Opublikowane' AND e.start_datetime IS NOT NULL
    AND tstzrange(e.start_datetime, e.start_datetime + COALESCE(e.duration_minutes, 60) * interval '1 minute', '[)') && c.b)
  AND (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.id IS DISTINCT FROM p_ignore
    AND (k.starts_at AT TIME ZONE 'Europe/Warsaw')::date = c.ld) < s.daily_limit
  AND (s.weekly_limit IS NULL OR (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.id IS DISTINCT FROM p_ignore
    AND date_trunc('week', k.starts_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('week', c.st AT TIME ZONE 'Europe/Warsaw')) < s.weekly_limit)
  AND (c.monthly_limit IS NULL OR (SELECT count(*) FROM public.bk_bookings k WHERE k.status = 'POTWIERDZONA' AND k.type_id = p_type
    AND k.id IS DISTINCT FROM p_ignore
    AND date_trunc('month', k.starts_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', c.st AT TIME ZONE 'Europe/Warsaw')) < c.monthly_limit)
ORDER BY c.st
$f$;

-- 6) Limit prób: 5 na IP / 10 min, 3 na e-mail / godzinę. Klucze to HMAC liczony na serwerze funkcji.
CREATE OR REPLACE FUNCTION public.bk_rate_hit(p_ip text, p_email text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $r$
BEGIN
  DELETE FROM public.bk_rate WHERE at < now() - interval '1 day';
  INSERT INTO public.bk_rate (bucket, key_hmac) VALUES ('ip', p_ip);
  IF p_email IS NOT NULL THEN INSERT INTO public.bk_rate (bucket, key_hmac) VALUES ('email', p_email); END IF;
  IF (SELECT count(*) FROM public.bk_rate WHERE bucket = 'ip' AND key_hmac = p_ip AND at > now() - interval '10 minutes') > 5 THEN RETURN 'rate'; END IF;
  IF p_email IS NOT NULL AND (SELECT count(*) FROM public.bk_rate WHERE bucket = 'email' AND key_hmac = p_email AND at > now() - interval '1 hour') > 3 THEN RETURN 'rate'; END IF;
  RETURN 'ok';
END $r$;

-- 7) Rezerwacja atomowo. Dane o zdrowiu przychodzą już zaszyfrowane (AES-256-GCM, serwer funkcji) jako hex.
CREATE OR REPLACE FUNCTION public.bk_book(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $b$
DECLARE
  v_s public.bk_settings; v_t public.bk_types; v_ex public.bk_bookings; v_id uuid; v_en timestamptz;
  v_st timestamptz := (p->>'starts_at')::timestamptz;
  v_vadmin boolean := COALESCE((p->>'viewer_admin')::boolean, false);
  v_src text := COALESCE(p->>'source', 'klient');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bk_calendar'));
  SELECT * INTO v_s FROM public.bk_settings WHERE id = 1;
  IF v_s.mode = 'off' OR (v_s.mode = 'admin' AND NOT v_vadmin) THEN RETURN jsonb_build_object('error', 'disabled'); END IF;
  IF p->>'idem_key' IS NOT NULL THEN
    SELECT * INTO v_ex FROM public.bk_bookings WHERE idem_key = p->>'idem_key';
    IF FOUND THEN RETURN jsonb_build_object('ok', true, 'already', true, 'id', v_ex.id, 'starts_at', v_ex.starts_at, 'ends_at', v_ex.ends_at); END IF;
  END IF;
  SELECT * INTO v_t FROM public.bk_types WHERE id = (p->>'type_id')::uuid;
  IF NOT FOUND OR (NOT v_t.active AND NOT v_vadmin) THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_src <> 'admin' AND v_t.access <> 'PUBLICZNY' THEN RETURN jsonb_build_object('error', 'access'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bk_free_slots(v_t.id, v_st, v_st + interval '1 minute', v_src = 'admin') f WHERE f.slot_start = v_st) THEN
    RETURN jsonb_build_object('error', 'taken');
  END IF;
  v_en := v_st + v_t.duration_min * interval '1 minute';
  BEGIN
    INSERT INTO public.bk_bookings (type_id, user_id, email, first_name, is_public, starts_at, ends_at, busy, client_tz, source, idem_key)
    VALUES (v_t.id, p->>'user_id', p->>'email', p->>'first_name', v_t.access = 'PUBLICZNY', v_st, v_en,
      tstzrange(v_st - v_t.buffer_before * interval '1 minute', v_en + v_t.buffer_after * interval '1 minute', '[)'),
      p->>'tz', v_src, p->>'idem_key')
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN exclusion_violation THEN RETURN jsonb_build_object('error', 'taken');
    WHEN unique_violation THEN RETURN jsonb_build_object('error', 'one_per_email');
  END;
  IF p ? 'answers' OR COALESCE(p->>'health_enc', '') <> '' THEN
    INSERT INTO public.bk_answers (booking_id, answers, health_enc, health_consent, delete_after)
    VALUES (v_id, p->'answers',
      CASE WHEN COALESCE(p->>'health_enc', '') <> '' THEN decode(p->>'health_enc', 'hex') END,
      COALESCE((p->>'health_consent')::boolean, false), v_en + interval '60 days');
  END IF;
  INSERT INTO public.bk_consents (booking_id, kind, text_version, text, email_hmac, ip_hmac)
  SELECT v_id, x.kind, x.text_version, x.text, x.email_hmac, x.ip_hmac
  FROM jsonb_to_recordset(COALESCE(p->'consents', '[]')) AS x(kind text, text_version text, text text, email_hmac text, ip_hmac text);
  IF p->>'token_hash' IS NOT NULL THEN
    INSERT INTO public.bk_tokens (purpose, token_hash, owner_user_id, owner_email, booking_id, expires_at)
    VALUES ('zarzadzaj', p->>'token_hash', p->>'user_id', p->>'email', v_id, v_en + interval '30 days');
  END IF;
  INSERT INTO public.bk_log (actor, action, object_type, object_id, summary)
  VALUES (COALESCE(p->>'actor', v_src), 'rezerwacja', 'booking', v_id::text, v_t.slug || ' ' || to_char(v_st AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI'));
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'starts_at', v_st, 'ends_at', v_en);
END $b$;

CREATE OR REPLACE FUNCTION public.bk_manage_view(p_hash text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $m$
  SELECT jsonb_build_object('type', t.name, 'starts_at', k.starts_at, 'ends_at', k.ends_at, 'status', k.status, 'first_name', k.first_name)
  FROM public.bk_tokens x JOIN public.bk_bookings k ON k.id = x.booking_id JOIN public.bk_types t ON t.id = k.type_id
  WHERE x.token_hash = p_hash AND x.purpose = 'zarzadzaj' AND x.used_at IS NULL AND x.expires_at > now() AND k.status = 'POTWIERDZONA'
$m$;

-- Odczyt odpowiedzi o zdrowiu: zwraca zaszyfrowaną wartość (hex) — odszyfrowuje ją wyłącznie funkcja serwera.
DROP FUNCTION IF EXISTS public.bk_admin_detail(uuid, text);
CREATE OR REPLACE FUNCTION public.bk_admin_detail(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $d$
  SELECT jsonb_build_object('answers', a.answers, 'health_consent', a.health_consent, 'deleted_at', a.deleted_at,
    'health_enc', CASE WHEN a.health_enc IS NOT NULL THEN encode(a.health_enc, 'hex') END)
  FROM public.bk_answers a WHERE a.booking_id = p_id
$d$;

CREATE OR REPLACE FUNCTION public.bk_answers_retention() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $t$
DECLARE n int;
BEGIN
  UPDATE public.bk_answers SET answers = NULL, health_enc = NULL, deleted_at = now()
  WHERE delete_after < now() AND deleted_at IS NULL AND NOT keep;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $t$;

-- 8) Dostęp do danych: wyłącznie serwer (service_role). RLS bez polityk blokuje role anon/authenticated w PostgREST.
DO $x$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['bk_settings','bk_types','bk_hours','bk_blocks','bk_holidays','bk_packages','bk_bookings',
    'bk_answers','bk_consents','bk_tokens','bk_notifications','bk_rate','bk_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', r);
  END LOOP;
END $x$;
REVOKE ALL ON SEQUENCE public.bk_log_id_seq, public.bk_rate_id_seq FROM PUBLIC, anon, authenticated;

-- 9) Wykonanie funkcji bk_*: odebrane PUBLIC/anon/authenticated, zostaje tylko service_role.
REVOKE EXECUTE ON FUNCTION public.bk_easter(int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_log_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_free_slots(uuid, timestamptz, timestamptz, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_book(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_rate_hit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_manage_view(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_admin_detail(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_log_anonymize(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_log_purge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_fill_holidays(int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bk_answers_retention() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bk_free_slots(uuid, timestamptz, timestamptz, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_book(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_rate_hit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_manage_view(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_admin_detail(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_log_anonymize(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_log_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_fill_holidays(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.bk_answers_retention() TO service_role;

-- 10) pgcrypto usuwane — nic już z niego nie korzysta (szyfrowanie przeniesione do funkcji serwera).
DO $x$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.prokind = 'f' AND n.nspname NOT IN ('pg_catalog','information_schema','extensions')
       AND p.prosrc ILIKE '%pgp_%') THEN
    DROP EXTENSION pgcrypto;
  END IF;
END $x$;

SELECT public.bk_fill_holidays(2);
NOTIFY pgrst, 'reload schema';
`;

// Rodzaje startowe — NIEAKTYWNE, do akceptacji w panelu.
export const SEED_SQL = `
INSERT INTO public.bk_types (slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, monthly_limit, sort, questions) VALUES
 ('rozmowa-kwalifikacyjna', 'Rozmowa kwalifikacyjna POWRÓT', 'Bezpłatna rozmowa, po której oboje wiemy, czy POWRÓT jest dla Ciebie.', 30, 15, 15, 30, 30, 'PUBLICZNY', NULL, 1,
  '[{"id":"q1","label":"Co sprawia, że szukasz zmiany właśnie teraz?","required":true},
    {"id":"q2","label":"Którą śmierć przeżywasz: mentalną, duchową czy życiową? Opisz krótko.","required":true},
    {"id":"q3","label":"Co już próbowałeś/aś zrobić?","required":false},
    {"id":"q4","label":"Czego oczekujesz po tej rozmowie?","required":true},
    {"id":"q5","label":"Czy jesteś obecnie pod opieką specjalisty (psycholog, psychiatra, terapeuta)?","required":false,"health":true}]'),
 ('rozmowa-na-progu', 'Rozmowa na progu', NULL, 90, 15, 15, 30, 60, 'PO_ZAKUPIE', 4, 2, '[]'),
 ('sesja-powrot', 'Sesja POWRÓT', NULL, 90, 15, 15, 30, 90, 'PAKIET', NULL, 3, '[]'),
 ('sesja-kontrolna', 'Sesja kontrolna POWRÓT', NULL, 60, 15, 15, 30, 90, 'PAKIET', NULL, 4, '[]')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.bk_hours (type_id, weekday, start_local, end_local)
SELECT t.id, w, '10:00', '12:00' FROM public.bk_types t, unnest(ARRAY[2,5]) w
WHERE t.slug = 'rozmowa-kwalifikacyjna' AND NOT EXISTS (SELECT 1 FROM public.bk_hours h WHERE h.type_id = t.id);
`;