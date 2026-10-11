// Moduł „Moja biblioteka" + „Wiadomości" — schemat w Supabase (ETAP 1A).
// Wyłącznie NOWE tabele i funkcje z prefiksem mb_ — żadna istniejąca tabela nie jest dotykana,
// dlatego nie robimy eksportu kopii (nie ma czego cofać).
// Każde polecenie jest powtarzalne (IF NOT EXISTS / CREATE OR REPLACE).

export const SCHEMA_SQL = `
-- ============ 1. USTAWIENIA MODUŁU ============
-- Dwa niezależne przełączniki trójstanowe (domyślnie „off"), próg przestrzeni i adres WhatsApp.
CREATE TABLE IF NOT EXISTS public.mb_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  library_mode text NOT NULL DEFAULT 'off' CHECK (library_mode IN ('off','admin','on')),
  messages_mode text NOT NULL DEFAULT 'off' CHECK (messages_mode IN ('off','admin','on')),
  email_notify boolean NOT NULL DEFAULT false,
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^https://wa\\.me/[0-9]{6,20}$'),
  space_limit_mb int NOT NULL DEFAULT 5120 CHECK (space_limit_mb BETWEEN 64 AND 1048576),
  tick_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.mb_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ 2. MATERIAŁY ============
-- Plik trzymany wyłącznie w prywatnym magazynie; w bazie sam klucz (bez nazw i e-maili w ścieżce).
-- Adresy wideo zapisujemy jako dostawcę + znormalizowany identyfikator, nigdy jako surowy adres.
CREATE TABLE IF NOT EXISTS public.mb_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  kind text NOT NULL CHECK (kind IN ('AUDIO','WIDEO','PDF','LINK','TEKST')),
  file_key text CHECK (file_key IS NULL OR (length(file_key) <= 500 AND position('@' in file_key) = 0)),
  file_name text CHECK (file_name IS NULL OR length(file_name) <= 300),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  file_version int NOT NULL DEFAULT 1 CHECK (file_version >= 1),
  prev_file_key text CHECK (prev_file_key IS NULL OR (length(prev_file_key) <= 500 AND position('@' in prev_file_key) = 0)),
  prev_file_name text CHECK (prev_file_name IS NULL OR length(prev_file_name) <= 300),
  prev_file_size bigint CHECK (prev_file_size IS NULL OR prev_file_size >= 0),
  pdf_js_warning boolean NOT NULL DEFAULT false,
  external_url text CHECK (external_url IS NULL OR external_url ~ '^https://'),
  video_provider text CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','bunny')),
  video_id text CHECK (video_id IS NULL OR length(video_id) <= 120),
  body_html text CHECK (body_html IS NULL OR length(body_html) <= 20000),
  stage text CHECK (stage IS NULL OR length(stage) <= 60),
  tags text[] NOT NULL DEFAULT '{}',
  duration_s int CHECK (duration_s IS NULL OR duration_s >= 0),
  pages int CHECK (pages IS NULL OR pages >= 0),
  allow_download boolean NOT NULL DEFAULT false,
  source text CHECK (source IS NULL OR length(source) <= 200),
  deleted_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Rodzaj decyduje, skąd pochodzi treść: plik, adres, odtwarzacz albo tekst — nigdy dwa naraz.
  CHECK (CASE kind
    WHEN 'AUDIO' THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'PDF'   THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'WIDEO' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NOT NULL AND video_id IS NOT NULL AND body_html IS NULL
    WHEN 'LINK'  THEN file_key IS NULL AND external_url IS NOT NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NULL
    WHEN 'TEKST' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NOT NULL
  END)
);
CREATE INDEX IF NOT EXISTS mb_materials_live ON public.mb_materials (kind, created_at DESC) WHERE deleted_at IS NULL;

-- ============ 3. KOLEKCJE ============
CREATE TABLE IF NOT EXISTS public.mb_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  sort int NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.mb_collection_items (
  collection_id uuid NOT NULL REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, material_id)
);
CREATE INDEX IF NOT EXISTS mb_collection_items_order ON public.mb_collection_items (collection_id, position);

-- ============ 4. GRUPY = ZNACZNIKI ============
CREATE TABLE IF NOT EXISTS public.mb_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  color text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  kind text NOT NULL DEFAULT 'RECZNA' CHECK (kind IN ('RECZNA','AUTOMATYCZNA')),
  rule jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'RECZNA' AND rule IS NULL)
      OR (kind = 'AUTOMATYCZNA' AND rule IS NOT NULL AND rule->>'typ' IN ('produkt','aktywny_pakiet')))
);
CREATE TABLE IF NOT EXISTS public.mb_group_members (
  group_id uuid NOT NULL REFERENCES public.mb_groups(id) ON DELETE CASCADE,
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  added_by text,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, client_email)
);
CREATE INDEX IF NOT EXISTS mb_group_members_email ON public.mb_group_members (client_email);

-- ============ 5. PRZYDZIAŁY ============
-- Widoczność liczona przy każdym otwarciu, bez kopiowania wierszy na osoby.
-- TYLKO_OBECNI zamraża listę członków na dzień przydziału (snapshot_emails).
CREATE TABLE IF NOT EXISTS public.mb_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  target_kind text NOT NULL CHECK (target_kind IN ('osoba','grupa')),
  target_email text CHECK (target_email IS NULL OR (target_email = lower(btrim(target_email)) AND length(target_email) <= 320)),
  group_id uuid REFERENCES public.mb_groups(id) ON DELETE CASCADE,
  group_mode text CHECK (group_mode IS NULL OR group_mode IN ('OBECNI_I_PRZYSZLI','TYLKO_OBECNI')),
  snapshot_emails text[] NOT NULL DEFAULT '{}',
  exceptions_add text[] NOT NULL DEFAULT '{}',
  exceptions_drop text[] NOT NULL DEFAULT '{}',
  note text CHECK (note IS NULL OR length(note) <= 2000),
  visible_from timestamptz,
  visible_to timestamptz,
  notified_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK ((material_id IS NOT NULL) <> (collection_id IS NOT NULL)),
  CHECK ((target_kind = 'osoba' AND target_email IS NOT NULL AND group_id IS NULL AND group_mode IS NULL)
      OR (target_kind = 'grupa' AND group_id IS NOT NULL AND target_email IS NULL AND group_mode IS NOT NULL)),
  CHECK (visible_to IS NULL OR visible_from IS NULL OR visible_to > visible_from)
);
CREATE INDEX IF NOT EXISTS mb_assign_email ON public.mb_assignments (target_email) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_group ON public.mb_assignments (group_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_material ON public.mb_assignments (material_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_collection ON public.mb_assignments (collection_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS mb_assign_pending ON public.mb_assignments (created_at) WHERE notified_at IS NULL AND revoked_at IS NULL;

-- ============ 6. STAN U KLIENTA ============
CREATE TABLE IF NOT EXISTS public.mb_material_state (
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  material_id uuid NOT NULL REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  opened_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (client_email, material_id)
);
CREATE INDEX IF NOT EXISTS mb_state_material ON public.mb_material_state (material_id);

-- ============ 7. WIADOMOŚCI (jednostronne) ============
-- target = definicja odbiorców; lista odbiorców powstaje dopiero w chwili wysyłki.
-- WYSYLANIE = wiadomość przejęta atomowo przez zadanie (blokada przed podwójną wysyłką).
CREATE TABLE IF NOT EXISTS public.mb_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body_html text NOT NULL CHECK (length(body_html) <= 20000),
  status text NOT NULL DEFAULT 'SZKIC' CHECK (status IN ('SZKIC','ZAPLANOWANA','WYSYLANIE','WYSLANA','WYCOFANA')),
  send_at timestamptz,
  email_mode text NOT NULL DEFAULT 'BRAK' CHECK (email_mode IN ('BRAK','POWIADOMIENIE','PELNA')),
  attached_material_id uuid REFERENCES public.mb_materials(id) ON DELETE SET NULL,
  attached_collection_id uuid REFERENCES public.mb_collections(id) ON DELETE SET NULL,
  target jsonb,
  recipient_count int NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  idem_key text UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  withdrawn_at timestamptz,
  CHECK (status <> 'ZAPLANOWANA' OR send_at IS NOT NULL),
  CHECK (attached_material_id IS NULL OR attached_collection_id IS NULL)
);
CREATE INDEX IF NOT EXISTS mb_messages_due ON public.mb_messages (send_at) WHERE status = 'ZAPLANOWANA';
CREATE INDEX IF NOT EXISTS mb_messages_status ON public.mb_messages (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mb_message_recipients (
  message_id uuid NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  client_email text NOT NULL CHECK (client_email = lower(btrim(client_email)) AND length(client_email) <= 320),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  hidden_at timestamptz,
  PRIMARY KEY (message_id, client_email)
);
CREATE INDEX IF NOT EXISTS mb_rcpt_email ON public.mb_message_recipients (client_email, delivered_at DESC);
CREATE INDEX IF NOT EXISTS mb_rcpt_read ON public.mb_message_recipients (message_id, read_at);

CREATE TABLE IF NOT EXISTS public.mb_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 120),
  title text CHECK (title IS NULL OR length(title) <= 200),
  body_html text NOT NULL CHECK (length(body_html) <= 20000),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 8. LIMIT WYDAWANIA LINKÓW ============
CREATE TABLE IF NOT EXISTS public.mb_rate (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL CHECK (bucket IN ('link')),
  key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mb_rate_key ON public.mb_rate (key_hash, at);

-- ============ 9. HISTORIA ZMIAN (tylko dopisywanie) ============
CREATE TABLE IF NOT EXISTS public.mb_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  object_type text,
  object_id text,
  summary text CHECK (summary IS NULL OR length(summary) <= 500),
  anonymized boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS mb_log_at ON public.mb_log (at DESC);

DO $r$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mb_log_maint') THEN
    CREATE ROLE mb_log_maint NOLOGIN;
  END IF;
END $r$;
GRANT USAGE ON SCHEMA public TO mb_log_maint;
-- CREATE na schemacie jest potrzebne wyłącznie po to, by przekazać funkcję czyszczącą na własność tej roli.
GRANT CREATE ON SCHEMA public TO mb_log_maint;
GRANT SELECT, UPDATE, DELETE ON public.mb_log TO mb_log_maint;

CREATE OR REPLACE FUNCTION public.mb_log_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $g$
BEGIN
  IF current_user = 'mb_log_maint' THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'mb_log: wpisy mozna tylko dopisywac';
END $g$;
DROP TRIGGER IF EXISTS mb_log_no_change ON public.mb_log;
CREATE TRIGGER mb_log_no_change BEFORE UPDATE OR DELETE ON public.mb_log FOR EACH ROW EXECUTE FUNCTION public.mb_log_guard();
DROP TRIGGER IF EXISTS mb_log_no_truncate ON public.mb_log;
CREATE TRIGGER mb_log_no_truncate BEFORE TRUNCATE ON public.mb_log FOR EACH STATEMENT EXECUTE FUNCTION public.mb_log_guard();

-- Historia zmian trzymana 12 miesięcy.
CREATE OR REPLACE FUNCTION public.mb_log_purge() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $p$
DECLARE n int;
BEGIN
  DELETE FROM public.mb_log WHERE at < now() - interval '12 months';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $p$;
ALTER FUNCTION public.mb_log_purge() OWNER TO mb_log_maint;
REVOKE CREATE ON SCHEMA public FROM mb_log_maint;

-- ============ 9b. GRUPY AUTOMATYCZNE (jedno miejsce prawdy) ============
-- Członkostwo grupy automatycznej liczone wyłącznie ODCZYTEM istniejących danych:
-- opłacone zamówienia (orders) i aktywne pakiety (bk_packages). Zero zmian w zakupach i rezerwacjach.
-- Ta sama reguła obsługuje widoczność materiałów, listę odbiorców wiadomości i podgląd w panelu.
CREATE OR REPLACE FUNCTION public.mb_auto_group_emails(p_rule jsonb)
RETURNS TABLE (email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $ae$
BEGIN
  IF p_rule->>'typ' = 'produkt' AND COALESCE(p_rule->>'id','') <> '' THEN
    RETURN QUERY
      SELECT DISTINCT lower(btrim(o.buyer_email))
        FROM public.orders o, jsonb_array_elements(o.items) e
       WHERE o.status = 'COMPLETED' AND e->>'product_id' = p_rule->>'id' AND o.buyer_email IS NOT NULL;
  ELSIF p_rule->>'typ' = 'aktywny_pakiet' THEN
    RETURN QUERY
      SELECT DISTINCT lower(btrim(p.email_display))
        FROM public.bk_packages p
       WHERE p.payment_status = 'oplacony' AND p.valid_until > now()
         AND p.sessions_used < p.sessions_total AND p.email_display IS NOT NULL;
  END IF;
END $ae$;

-- Kto jest w grupie TERAZ: członkowie ręczni plus, dla grupy automatycznej, aktualny wynik reguły.
CREATE OR REPLACE FUNCTION public.mb_group_members_now(p_group uuid)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $gm$
  SELECT DISTINCT lower(btrim(m.client_email)) AS email
    FROM public.mb_group_members m WHERE m.group_id = p_group
  UNION
  SELECT e.email FROM public.mb_groups g, public.mb_auto_group_emails(g.rule) e
   WHERE g.id = p_group AND g.kind = 'AUTOMATYCZNA'
$gm$;

-- ============ 10. REGUŁA WIDOCZNOŚCI (jedno miejsce prawdy) ============
-- Zwraca materiały widoczne dla danej osoby: przydział wprost, przez grupę wg trybu,
-- z wyjątkami (dodani / wykluczeni), w oknie dat, przy włączonym przełączniku modułu.
-- Materiał z dwóch źródeł występuje raz (pierwszeństwo ma przydział wprost).
CREATE OR REPLACE FUNCTION public.mb_visible_materials(p_email text, p_admin boolean DEFAULT false)
RETURNS TABLE (material_id uuid, collection_id uuid, assignment_id uuid, note text, visible_from timestamptz, visible_to timestamptz, pos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $vm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
s AS (SELECT library_mode FROM public.mb_settings WHERE id = 1),
-- „moje grupy": ręczne (z listy członków) ORAZ automatyczne (aktualny wynik reguły zakupowej / pakietowej)
mine AS (
  SELECT m.group_id FROM public.mb_group_members m, me WHERE m.client_email = me.mail
  UNION
  SELECT g.id FROM public.mb_groups g, me
   WHERE g.kind = 'AUTOMATYCZNA' AND me.mail <> ''
     AND me.mail IN (SELECT e.email FROM public.mb_auto_group_emails(g.rule) e)
),
a AS (
  SELECT x.*, CASE WHEN x.target_kind = 'osoba' THEN 0 ELSE 1 END AS prio
  FROM public.mb_assignments x, me, s
  WHERE x.revoked_at IS NULL
    AND me.mail <> ''
    AND (s.library_mode = 'on' OR (s.library_mode = 'admin' AND p_admin))
    AND (x.visible_from IS NULL OR x.visible_from <= now())
    AND (x.visible_to IS NULL OR x.visible_to > now())
    AND (
      (x.target_kind = 'osoba' AND x.target_email = me.mail)
      OR (x.target_kind = 'grupa' AND NOT (me.mail = ANY(x.exceptions_drop)) AND (
           (x.group_mode = 'OBECNI_I_PRZYSZLI' AND (x.group_id IN (SELECT group_id FROM mine) OR me.mail = ANY(x.exceptions_add)))
        OR (x.group_mode = 'TYLKO_OBECNI' AND (
             (me.mail = ANY(x.snapshot_emails) AND me.mail IN (SELECT e.email FROM public.mb_group_members_now(x.group_id) e))
             OR me.mail = ANY(x.exceptions_add)))
      ))
    )
),
rows AS (
  SELECT m.id AS mid, a.collection_id, a.id AS aid, a.note, a.visible_from, a.visible_to,
         COALESCE(ci.position, 0) AS pos, a.prio
  FROM a
  JOIN public.mb_materials m ON m.id = a.material_id AND m.deleted_at IS NULL
  LEFT JOIN public.mb_collection_items ci ON ci.collection_id = a.collection_id AND ci.material_id = m.id
  WHERE a.material_id IS NOT NULL
  UNION ALL
  SELECT m.id, a.collection_id, a.id, a.note, a.visible_from, a.visible_to, ci.position, a.prio
  FROM a
  JOIN public.mb_collection_items ci ON ci.collection_id = a.collection_id
  JOIN public.mb_materials m ON m.id = ci.material_id AND m.deleted_at IS NULL
  WHERE a.collection_id IS NOT NULL
)
SELECT DISTINCT ON (mid) mid, collection_id, aid, note, visible_from, visible_to, pos
FROM rows ORDER BY mid, prio, pos
$vm$;

-- ============ 11. ODBIORCY (jedno miejsce prawdy) ============
-- Grupa wg trybu, minus wykluczeni, plus dodani, bez powtórzeń. Używane i do podglądu, i do wysyłki.
CREATE OR REPLACE FUNCTION public.mb_resolve_recipients(p_target jsonb)
RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $rr$
WITH t AS (SELECT p_target AS p),
tg AS (
  SELECT (t.p->>'group_id')::uuid AS gid, COALESCE(t.p->>'group_mode','') AS mode, t.p
  FROM t
  WHERE t.p->>'kind' = 'grupa'
    AND (t.p->>'group_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
),
base AS (
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'emails','[]')) AS x(e)
  UNION
  -- grupa wg trybu: „obecni i przyszli" = wszyscy w grupie teraz (ręczni i automatyczni)
  SELECT e.email FROM tg, public.mb_group_members_now(tg.gid) e WHERE tg.mode = 'OBECNI_I_PRZYSZLI'
  UNION
  -- „tylko obecni": z listy z chwili przydziału zostają wyłącznie osoby, które nadal są w grupie
  SELECT lower(btrim(x.e)) AS email FROM tg, jsonb_array_elements_text(COALESCE(tg.p->'snapshot_emails','[]')) AS x(e)
    WHERE tg.mode = 'TYLKO_OBECNI'
      AND lower(btrim(x.e)) IN (SELECT e.email FROM public.mb_group_members_now(tg.gid) e)
  UNION
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'exceptions_add','[]')) AS x(e)
),
drop_ AS (
  SELECT lower(btrim(x.e)) AS email FROM t, jsonb_array_elements_text(COALESCE(t.p->'exceptions_drop','[]')) AS x(e)
)
SELECT DISTINCT b.email FROM base b
WHERE b.email IS NOT NULL AND b.email <> ''
  AND NOT EXISTS (SELECT 1 FROM drop_ d WHERE d.email = b.email)
$rr$;

-- ============ 12. PRZENIESIENIE DANYCH PRZY ZMIANIE ADRESU ============
-- Jedna transakcja: wszystkie tabele mb_* oraz adresy wewnątrz tablic wyjątków i snapshotów.
-- Przygotowane w 1A; podpięcie do modułu zmiany adresu nastąpi w 1C.
CREATE OR REPLACE FUNCTION public.mb_move_email(p_old text, p_new text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mv$
DECLARE
  o text := lower(btrim(COALESCE(p_old,'')));
  n text := lower(btrim(COALESCE(p_new,'')));
  c jsonb := '{}'::jsonb;
  k int;
BEGIN
  IF o = '' OR n = '' OR strpos(n, '@') = 0 OR length(n) > 320 THEN
    RETURN jsonb_build_object('error','bad');
  END IF;
  IF o = n THEN RETURN jsonb_build_object('ok', true, 'same', true); END IF;

  DELETE FROM public.mb_group_members a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_group_members b WHERE b.group_id = a.group_id AND b.client_email = n);
  UPDATE public.mb_group_members SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('grupy', k);

  UPDATE public.mb_assignments SET target_email = n WHERE target_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('przydzialy', k);

  UPDATE public.mb_assignments
    SET exceptions_add = array_replace(exceptions_add, o, n),
        exceptions_drop = array_replace(exceptions_drop, o, n),
        snapshot_emails = array_replace(snapshot_emails, o, n)
    WHERE o = ANY(exceptions_add) OR o = ANY(exceptions_drop) OR o = ANY(snapshot_emails);
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('wyjatki', k);

  DELETE FROM public.mb_material_state a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_material_state b WHERE b.material_id = a.material_id AND b.client_email = n);
  UPDATE public.mb_material_state SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('stany', k);

  DELETE FROM public.mb_message_recipients a WHERE a.client_email = o
    AND EXISTS (SELECT 1 FROM public.mb_message_recipients b WHERE b.message_id = a.message_id AND b.client_email = n);
  UPDATE public.mb_message_recipients SET client_email = n WHERE client_email = o;
  GET DIAGNOSTICS k = ROW_COUNT; c := c || jsonb_build_object('odbiorcy', k);

  INSERT INTO public.mb_log (actor, action, object_type, object_id, summary)
  VALUES ('system', 'zmiana_adresu', 'klient', NULL, 'dane biblioteki przeniesione');
  RETURN jsonb_build_object('ok', true, 'przeniesione', c);
END $mv$;

-- ============ 13. LIMIT WYDAWANIA LINKÓW ============
CREATE OR REPLACE FUNCTION public.mb_link_hit(p_key text, p_limit int DEFAULT 30) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $lh$
BEGIN
  DELETE FROM public.mb_rate WHERE at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.mb_rate WHERE key_hash = p_key AND at > now() - interval '1 hour') >= p_limit THEN
    RETURN 'rate';
  END IF;
  INSERT INTO public.mb_rate (bucket, key_hash) VALUES ('link', p_key);
  RETURN 'ok';
END $lh$;

-- ============ 14. DOSTĘP: wyłącznie serwer ============
-- RLS bez polityk = brak dostępu z zewnątrz; uprawnienia odebrane anon/authenticated.
DO $x$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['mb_settings','mb_materials','mb_collections','mb_collection_items','mb_groups','mb_group_members',
    'mb_assignments','mb_material_state','mb_messages','mb_message_recipients','mb_templates','mb_rate','mb_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', r);
  END LOOP;
END $x$;
REVOKE ALL ON SEQUENCE public.mb_rate_id_seq, public.mb_log_id_seq FROM PUBLIC, anon, authenticated;

-- Wszystkie funkcje mb_*: jawnie odbieramy PUBLIC/anon/authenticated, zostaje tylko service_role.
-- (PostgreSQL nadaje EXECUTE dla PUBLIC domyślnie — dlatego każda funkcja jest wymieniona z nazwy.)
REVOKE ALL ON FUNCTION public.mb_log_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_purge() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_auto_group_emails(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_group_members_now(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_visible_materials(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_resolve_recipients(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_move_email(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_link_hit(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mb_log_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_auto_group_emails(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_group_members_now(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_visible_materials(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_resolve_recipients(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_move_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_link_hit(text, int) TO service_role;

NOTIFY pgrst, 'reload schema';
`;

// Grupy startowe do akceptacji w panelu (puste, ręczne).
export const SEED_SQL = `
INSERT INTO public.mb_groups (name, color, description, kind) VALUES
 ('POWRÓT — wszyscy uczestnicy', '#C9A24A', 'Wszyscy, którzy przeszli przez POWRÓT.', 'RECZNA'),
 ('Kohorta 1', '#BC1E22', 'Pierwsza grupa startowa.', 'RECZNA'),
 ('Rozmowa na progu', '#8A8A8C', 'Osoby po rozmowie wstępnej.', 'RECZNA'),
 ('Alumni', '#3D3D3F', 'Po zakończeniu programu.', 'RECZNA')
ON CONFLICT (name) DO NOTHING;
`;

// Kontrola po migracji: RLS włączone, zero polityk, brak uprawnień dla anon i authenticated.
export const CHECKPOINT_TABLES_SQL = `
SELECT c.relname AS tabela,
       c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS polityki,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
       has_table_privilege('anon', c.oid, 'INSERT') AS anon_insert,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname LIKE 'mb\\_%'
ORDER BY c.relname`;

export const CHECKPOINT_FUNCS_SQL = `
SELECT p.proname AS funkcja,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       (p.prosecdef) AS security_definer,
       (p.proconfig IS NOT NULL) AS search_path_ustawiony
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'mb\\_%'
ORDER BY p.proname`;