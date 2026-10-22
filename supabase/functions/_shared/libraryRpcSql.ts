// ETAP 2A — WYDAJNOŚĆ. Ścieżki częste przeniesione z Management API (runSql, ~1,5 s na zapytanie)
// na PostgREST RPC (~0,2–0,5 s), po jednym wywołaniu na akcję.
//
// Zasady bez zmian: każda funkcja robi JEDNĄ konkretną rzecz z parametrami (nigdy „wykonaj dowolny SQL"),
// SECURITY DEFINER, search_path = '', EXECUTE wyłącznie dla service_role.
// Reguła widoczności, odbiorcy, limit linków i historia zmian to nadal te same funkcje co w 1A/1B/1C.

export const LIBRARY_RPC_SQL = `
-- ============ USTAWIENIA (jedno miejsce prawdy) ============
CREATE OR REPLACE FUNCTION public.mb_lib_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ls$
  SELECT COALESCE(
    (SELECT jsonb_build_object('library_mode', s.library_mode, 'messages_mode', s.messages_mode,
       'email_notify', s.email_notify, 'whatsapp', s.whatsapp, 'space_limit_mb', s.space_limit_mb)
       FROM public.mb_settings s WHERE s.id = 1),
    jsonb_build_object('library_mode','off','messages_mode','off','email_notify',false,'whatsapp',NULL,'space_limit_mb',5120))
$ls$;

-- ============ ZUŻYCIE PRZESTRZENI ============
CREATE OR REPLACE FUNCTION public.mb_admin_space() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $sp$
WITH u AS (
  SELECT COALESCE(sum(COALESCE(file_size,0) + COALESCE(prev_file_size,0)),0)::bigint AS bytes,
         count(*)::int AS files
    FROM public.mb_materials WHERE deleted_at IS NULL AND file_key IS NOT NULL
), lim AS (SELECT COALESCE((SELECT space_limit_mb FROM public.mb_settings WHERE id = 1), 5120)::bigint AS mb)
SELECT jsonb_build_object('bytes', u.bytes, 'files', u.files, 'limit_mb', lim.mb,
  'procent', LEAST(100, GREATEST(0, round(u.bytes * 100.0 / (lim.mb * 1048576)))))
FROM u, lim
$sp$;

-- ============ KLIENT: BIBLIOTEKA ============
-- Dokładnie te same pola co dotąd w itemOf(): bez kluczy plików, bez nazw grup, bez list odbiorców.
-- Treść i odtwarzacze (embed) składa warstwa JS — tu wracają tylko dane.
CREATE OR REPLACE FUNCTION public.mb_client_library(p_email text, p_admin boolean DEFAULT false, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cl$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
v AS (SELECT * FROM public.mb_visible_materials(p_email, p_admin)),
m AS (
  SELECT mm.id, mm.title, mm.kind, mm.description, mm.duration_s, mm.pages, mm.stage, mm.tags,
         mm.external_url, mm.video_provider, mm.video_id, mm.body_html, mm.allow_download,
         (mm.file_key IS NOT NULL) AS has_file
    FROM public.mb_materials mm JOIN v ON v.material_id = mm.id
   WHERE mm.deleted_at IS NULL
),
st AS (
  SELECT s.material_id, s.opened_at, s.completed_at
    FROM public.mb_material_state s, me
   WHERE s.client_email = me.mail AND NOT p_preview
),
it AS (
  SELECT jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description,
    'duration_s', m.duration_s, 'pages', m.pages, 'stage', m.stage, 'tags', m.tags,
    'note', v.note, 'visible_from', v.visible_from, 'visible_to', v.visible_to,
    'collection_id', v.collection_id, 'position', v.pos,
    'opened_at', st.opened_at, 'completed_at', st.completed_at,
    'has_file', m.has_file, 'allow_download', m.allow_download,
    'external_url', m.external_url, 'video_provider', m.video_provider, 'video_id', m.video_id,
    'body_html', m.body_html) AS j,
    m.kind, v.collection_id, v.pos, m.title, st.opened_at
  FROM m JOIN v ON v.material_id = m.id LEFT JOIN st ON st.material_id = m.id
),
col AS (
  SELECT c.id, c.title, c.description,
    COALESCE((SELECT jsonb_agg(x.j ORDER BY x.pos, x.title) FROM it x WHERE x.collection_id = c.id), '[]'::jsonb) AS items
  FROM public.mb_collections c
  WHERE c.deleted_at IS NULL AND c.id IN (SELECT DISTINCT collection_id FROM it WHERE collection_id IS NOT NULL)
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(j ORDER BY kind, title) FROM it), '[]'::jsonb),
  'collections', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', col.id, 'title', col.title,
     'description', col.description, 'items', col.items) ORDER BY col.title) FROM col), '[]'::jsonb),
  'counts', jsonb_build_object(
    'AUDIO', (SELECT count(*) FROM it WHERE kind = 'AUDIO'),
    'WIDEO', (SELECT count(*) FROM it WHERE kind = 'WIDEO'),
    'PDF',   (SELECT count(*) FROM it WHERE kind = 'PDF'),
    'LINK',  (SELECT count(*) FROM it WHERE kind = 'LINK'),
    'TEKST', (SELECT count(*) FROM it WHERE kind = 'TEKST')),
  'unopened', (SELECT count(*) FROM it WHERE opened_at IS NULL))
$cl$;

-- ============ KLIENT: WIADOMOŚCI ============
CREATE OR REPLACE FUNCTION public.mb_client_messages(p_email text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
r AS (
  SELECT m.id, m.title, m.body_html, m.sent_at, m.attached_material_id, m.attached_collection_id,
         rr.read_at, mt.title AS material_title, mt.kind AS material_kind, cl.title AS collection_title
    FROM public.mb_message_recipients rr
    JOIN public.mb_messages m ON m.id = rr.message_id
    LEFT JOIN public.mb_materials mt ON mt.id = m.attached_material_id AND mt.deleted_at IS NULL
    LEFT JOIN public.mb_collections cl ON cl.id = m.attached_collection_id AND cl.deleted_at IS NULL
   WHERE rr.client_email = (SELECT mail FROM me) AND m.status = 'WYSLANA' AND rr.hidden_at IS NULL
   ORDER BY m.sent_at DESC NULLS LAST LIMIT 100
),
it AS (
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'sent_at', r.sent_at,
    'read_at', r.read_at, 'material_id', r.attached_material_id, 'collection_id', r.attached_collection_id,
    'material_title', r.material_title, 'material_kind', r.material_kind, 'collection_title', r.collection_title) AS j,
    r.sent_at, r.read_at
  FROM r
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sent_at DESC NULLS LAST) FROM it), '[]'::jsonb),
  'unread', CASE WHEN p_preview THEN 0 ELSE (SELECT count(*) FROM it WHERE it.read_at IS NULL) END)
$cm$;

-- ============ KLIENT: JEDNO WEJŚCIE ============
-- /konto dostaje przełączniki, bibliotekę i wiadomości jednym wywołaniem (zamiast 3–4).
CREATE OR REPLACE FUNCTION public.mb_client_bundle(p_email text, p_admin boolean DEFAULT false, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $cb$
DECLARE
  s jsonb;
  lm text;
  mm text;
BEGIN
  s := public.mb_lib_settings();
  lm := s->>'library_mode';
  mm := s->>'messages_mode';
  RETURN jsonb_build_object(
    'library_mode', lm,
    'messages_mode', mm,
    'whatsapp', s->'whatsapp',
    'library', CASE WHEN lm = 'on' OR (lm = 'admin' AND p_admin)
      THEN public.mb_client_library(p_email, p_admin, p_preview) ELSE NULL END,
    'messages', CASE WHEN mm = 'on' OR (mm = 'admin' AND p_admin)
      THEN public.mb_client_messages(p_email, p_preview) ELSE NULL END);
END $cb$;

-- ============ KLIENT: OTWARCIE MATERIAŁU ============
-- Sprawdzenie dostępu + dane materiału + limit linków + zapis „otwarte" w jednym wywołaniu.
-- Podpisany adres pliku nadal powstaje w warstwie funkcji — klucz pliku nigdy nie trafia do przeglądarki.
CREATE OR REPLACE FUNCTION public.mb_client_open(p_email text, p_admin boolean, p_material_id uuid,
  p_mark_opened boolean DEFAULT true, p_rate_key text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $co$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  m record;
  r text;
BEGIN
  IF p_material_id IS NULL THEN RETURN jsonb_build_object('status','denied'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN jsonb_build_object('status','denied');
  END IF;
  SELECT mm.id, mm.title, mm.kind, mm.file_key, mm.external_url, mm.video_provider, mm.video_id, mm.body_html, mm.allow_download
    INTO m FROM public.mb_materials mm WHERE mm.id = p_material_id AND mm.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','denied'); END IF;

  IF p_rate_key IS NOT NULL THEN
    r := public.mb_link_hit(p_rate_key, COALESCE(p_limit, 30));
    IF r <> 'ok' THEN RETURN jsonb_build_object('status','rate'); END IF;
  END IF;

  IF p_mark_opened THEN
    INSERT INTO public.mb_material_state (client_email, material_id, opened_at)
    VALUES (mail, p_material_id, now())
    ON CONFLICT (client_email, material_id)
    DO UPDATE SET opened_at = COALESCE(public.mb_material_state.opened_at, EXCLUDED.opened_at);
  END IF;

  RETURN jsonb_build_object('status','ok','material', jsonb_build_object(
    'id', m.id, 'title', m.title, 'kind', m.kind, 'file_key', m.file_key, 'external_url', m.external_url,
    'video_provider', m.video_provider, 'video_id', m.video_id, 'body_html', m.body_html, 'allow_download', m.allow_download));
END $co$;

-- ============ KLIENT: OZNACZENIE MATERIAŁU ============
CREATE OR REPLACE FUNCTION public.mb_material_complete(p_email text, p_admin boolean, p_material_id uuid, p_completed boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mc$
DECLARE mail text := lower(btrim(COALESCE(p_email,'')));
BEGIN
  IF p_material_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mb_visible_materials(p_email, p_admin) v WHERE v.material_id = p_material_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.mb_material_state (client_email, material_id, completed_at)
  VALUES (mail, p_material_id, CASE WHEN p_completed THEN now() ELSE NULL END)
  ON CONFLICT (client_email, material_id)
  DO UPDATE SET completed_at = CASE WHEN p_completed THEN now() ELSE NULL END;
  RETURN true;
END $mc$;

-- ============ KLIENT: PRZECZYTANE / UKRYTE ============
-- Brak wiersza odbiorcy = cudza wiadomość = odmowa bez ujawniania czegokolwiek.
CREATE OR REPLACE FUNCTION public.mb_message_flag(p_email text, p_message_id uuid, p_hidden boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mf$
DECLARE
  mail text := lower(btrim(COALESCE(p_email,'')));
  k int;
BEGIN
  IF p_message_id IS NULL THEN RETURN false; END IF;
  IF p_hidden THEN
    UPDATE public.mb_message_recipients SET hidden_at = COALESCE(hidden_at, now())
     WHERE message_id = p_message_id AND client_email = mail;
  ELSE
    UPDATE public.mb_message_recipients SET read_at = COALESCE(read_at, now())
     WHERE message_id = p_message_id AND client_email = mail;
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k > 0;
END $mf$;

-- ============ PANEL: ODCZYTY ============
CREATE OR REPLACE FUNCTION public.mb_admin_materials(p_kind text DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $am$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description, 'stage', m.stage, 'tags', m.tags,
  'file_version', m.file_version, 'file_size', m.file_size, 'prev_file_size', m.prev_file_size,
  'prev_file_name', m.prev_file_name, 'pdf_js_warning', m.pdf_js_warning, 'external_url', m.external_url,
  'video_provider', m.video_provider, 'video_id', m.video_id, 'duration_s', m.duration_s, 'pages', m.pages,
  'allow_download', m.allow_download, 'body_html', m.body_html, 'created_at', m.created_at, 'source', m.source,
  'przydzialy', (SELECT count(*) FROM public.mb_assignments x WHERE x.revoked_at IS NULL
     AND (x.material_id = m.id OR x.collection_id IN
       (SELECT ci.collection_id FROM public.mb_collection_items ci WHERE ci.material_id = m.id))),
  'otwarte', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.opened_at IS NOT NULL),
  'ukonczone', (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = m.id AND s.completed_at IS NOT NULL)
) ORDER BY m.created_at DESC), '[]'::jsonb)
FROM (
  SELECT * FROM public.mb_materials mm
   WHERE mm.deleted_at IS NULL
     AND (p_kind IS NULL OR mm.kind = p_kind)
     AND (p_q IS NULL OR p_q = '' OR mm.title ILIKE '%' || p_q || '%' OR COALESCE(mm.description,'') ILIKE '%' || p_q || '%')
   ORDER BY mm.created_at DESC LIMIT 500
) m
$am$;

CREATE OR REPLACE FUNCTION public.mb_admin_collections() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acl$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', c.id, 'title', c.title, 'description', c.description, 'sort', c.sort, 'created_at', c.created_at,
  'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('material_id', ci.material_id, 'position', ci.position,
      'title', mm.title, 'kind', mm.kind) ORDER BY ci.position)
    FROM public.mb_collection_items ci
    LEFT JOIN public.mb_materials mm ON mm.id = ci.material_id AND mm.deleted_at IS NULL
    WHERE ci.collection_id = c.id), '[]'::jsonb)
) ORDER BY c.sort, c.created_at), '[]'::jsonb)
FROM public.mb_collections c WHERE c.deleted_at IS NULL
$acl$;

-- Grupy z członkami liczonymi od razu w bazie — także automatycznymi (bez wywołania na grupę).
CREATE OR REPLACE FUNCTION public.mb_admin_groups() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ag$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', g.id, 'name', g.name, 'color', g.color, 'description', g.description, 'kind', g.kind, 'rule', g.rule,
  'accepted_at', g.accepted_at, 'created_at', g.created_at,
  'members', COALESCE((SELECT jsonb_agg(e.email ORDER BY e.email) FROM public.mb_group_members_now(g.id) e), '[]'::jsonb),
  'count', (SELECT count(*) FROM public.mb_group_members_now(g.id) e)
) ORDER BY g.kind, g.name), '[]'::jsonb)
FROM public.mb_groups g
$ag$;

CREATE OR REPLACE FUNCTION public.mb_admin_messages() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ams$
WITH src AS (
  SELECT m.*, g.name AS group_name
    FROM public.mb_messages m
    LEFT JOIN public.mb_groups g ON g.id = NULLIF(m.target->>'group_id','')::uuid
   ORDER BY COALESCE(m.sent_at, m.send_at, m.created_at) DESC LIMIT 200
),
it AS (
  SELECT jsonb_build_object(
    'id', s.id, 'title', s.title, 'body_html', s.body_html, 'status', s.status, 'send_at', s.send_at,
    'email_mode', s.email_mode, 'recipient_count', s.recipient_count, 'attached_material_id', s.attached_material_id,
    'attached_collection_id', s.attached_collection_id, 'target', s.target, 'created_at', s.created_at,
    'sent_at', s.sent_at, 'withdrawn_at', s.withdrawn_at, 'group_name', s.group_name,
    'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id),
    'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = s.id AND r.read_at IS NOT NULL)
  ) AS j, COALESCE(s.sent_at, s.send_at, s.created_at) AS sort
  FROM src s
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sort DESC) FROM it), '[]'::jsonb),
  'liczniki', (SELECT jsonb_build_object(
    'wyslane', count(*) FILTER (WHERE status = 'WYSLANA'),
    'zaplanowane', count(*) FILTER (WHERE status = 'ZAPLANOWANA'),
    'szkice', count(*) FILTER (WHERE status = 'SZKIC'),
    'wycofane', count(*) FILTER (WHERE status = 'WYCOFANA')) FROM public.mb_messages))
$ams$;

CREATE OR REPLACE FUNCTION public.mb_admin_dashboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ad$
SELECT jsonb_build_object(
  'zaplanowane_dzis', (SELECT count(*) FROM public.mb_messages WHERE status = 'ZAPLANOWANA'
     AND (send_at AT TIME ZONE 'Europe/Warsaw')::date = (now() AT TIME ZONE 'Europe/Warsaw')::date),
  'odblokowuje_sie', (SELECT count(*) FROM public.mb_assignments WHERE revoked_at IS NULL
     AND visible_from IS NOT NULL AND visible_from > now() AND visible_from < now() + interval '7 days'),
  'przestrzen', public.mb_admin_space(),
  'tryby', public.mb_lib_settings(),
  'ostatnia', (SELECT jsonb_build_object('id', m.id, 'title', m.title, 'sent_at', m.sent_at,
     'dostarczone', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = m.id),
     'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = m.id AND r.read_at IS NOT NULL))
     FROM public.mb_messages m WHERE m.status = 'WYSLANA' ORDER BY m.sent_at DESC LIMIT 1))
$ad$;

-- Fakty o klientach z tabel mb_* (grupy ręczne i automatyczne, aktywny pakiet) — bez listy kont Base44.
CREATE OR REPLACE FUNCTION public.mb_admin_clients_mb() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acm$
WITH g AS (SELECT gg.id, gg.name, gg.color, gg.kind, gg.rule FROM public.mb_groups gg),
members AS (
  SELECT lower(btrim(m.client_email)) AS email, m.group_id FROM public.mb_group_members m
  UNION
  SELECT lower(btrim(e.email)) AS email, g.id AS group_id
    FROM g, public.mb_auto_group_emails(g.rule) e WHERE g.kind = 'AUTOMATYCZNA'
),
pkg AS (
  SELECT DISTINCT lower(btrim(email_display)) AS email FROM public.bk_packages
   WHERE payment_status = 'oplacony' AND valid_until > now() AND sessions_used < sessions_total AND email_display IS NOT NULL
),
emails AS (SELECT email FROM members WHERE email <> '' UNION SELECT email FROM pkg WHERE email <> ''),
rows AS (
  SELECT jsonb_build_object('email', e.email,
    'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', gg.id, 'name', gg.name, 'color', gg.color, 'kind', gg.kind) ORDER BY gg.name)
      FROM g gg WHERE gg.id IN (SELECT mm.group_id FROM members mm WHERE mm.email = e.email)), '[]'::jsonb),
    'package', EXISTS (SELECT 1 FROM pkg p WHERE p.email = e.email)) AS j, e.email
  FROM emails e
)
SELECT COALESCE(jsonb_agg(j ORDER BY email), '[]'::jsonb) FROM rows
$acm$;

CREATE OR REPLACE FUNCTION public.mb_admin_client_mb(p_email text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $acd$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
g AS (
  SELECT gg.id, gg.name, gg.color, gg.kind FROM public.mb_groups gg
   WHERE (gg.kind = 'RECZNA' AND EXISTS (SELECT 1 FROM public.mb_group_members m
            WHERE m.group_id = gg.id AND m.client_email = (SELECT mail FROM me)))
      OR (gg.kind = 'AUTOMATYCZNA' AND (SELECT mail FROM me) IN
            (SELECT e.email FROM public.mb_auto_group_emails(gg.rule) e))
)
SELECT jsonb_build_object(
  'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'kind', g.kind) ORDER BY g.name) FROM g), '[]'::jsonb),
  'packages', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', p.id, 'sessions_total', p.sessions_total, 'sessions_used', p.sessions_used,
       'valid_until', p.valid_until, 'payment_status', p.payment_status, 'source', p.source, 'created_at', p.created_at) AS j,
       p.created_at
     FROM public.bk_packages p WHERE lower(btrim(p.email_display)) = (SELECT mail FROM me)
     ORDER BY p.created_at DESC LIMIT 20) x), '[]'::jsonb),
  'sends', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.sent_at DESC NULLS LAST) FROM (
     SELECT jsonb_build_object('id', m.id, 'title', m.title, 'sent_at', m.sent_at, 'read_at', r.read_at, 'hidden_at', r.hidden_at) AS j,
       m.sent_at
     FROM public.mb_message_recipients r JOIN public.mb_messages m ON m.id = r.message_id
     WHERE r.client_email = (SELECT mail FROM me) ORDER BY m.sent_at DESC NULLS LAST LIMIT 50) x), '[]'::jsonb),
  'assignments', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', a.id, 'material_id', a.material_id, 'collection_id', a.collection_id, 'note', a.note,
       'visible_from', a.visible_from, 'visible_to', a.visible_to, 'target_kind', a.target_kind, 'group_id', a.group_id,
       'group_name', gg.name, 'material_title', mm.title, 'collection_title', cc.title) AS j, a.created_at
     FROM public.mb_assignments a
     LEFT JOIN public.mb_groups gg ON gg.id = a.group_id
     LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
     LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
     WHERE a.revoked_at IS NULL AND (
       a.target_email = (SELECT mail FROM me)
       OR a.group_id IN (SELECT m.group_id FROM public.mb_group_members m WHERE m.client_email = (SELECT mail FROM me))
       OR a.group_id IN (SELECT g2.id FROM public.mb_groups g2 WHERE g2.kind = 'AUTOMATYCZNA'
            AND (SELECT mail FROM me) IN (SELECT e.email FROM public.mb_auto_group_emails(g2.rule) e)))
     ORDER BY a.created_at DESC LIMIT 200) x), '[]'::jsonb))
$acd$;

CREATE OR REPLACE FUNCTION public.mb_admin_group_detail(p_group uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $agd$
SELECT jsonb_build_object(
  'group', (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'description', g.description,
     'kind', g.kind, 'rule', g.rule, 'accepted_at', g.accepted_at) FROM public.mb_groups g WHERE g.id = p_group),
  'members', COALESCE((SELECT jsonb_agg(e.email ORDER BY e.email) FROM public.mb_group_members_now(p_group) e), '[]'::jsonb),
  'materials', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.created_at DESC) FROM (
     SELECT jsonb_build_object('id', a.id, 'material_id', a.material_id, 'collection_id', a.collection_id,
       'material_title', m.title, 'collection_title', c.title, 'visible_from', a.visible_from,
       'visible_to', a.visible_to, 'created_at', a.created_at) AS j, a.created_at
     FROM public.mb_assignments a
     LEFT JOIN public.mb_materials m ON m.id = a.material_id AND m.deleted_at IS NULL
     LEFT JOIN public.mb_collections c ON c.id = a.collection_id AND c.deleted_at IS NULL
     WHERE a.group_id = p_group AND a.revoked_at IS NULL ORDER BY a.created_at DESC LIMIT 200) x), '[]'::jsonb),
  'messages', COALESCE((SELECT jsonb_agg(x.j ORDER BY x.sort DESC) FROM (
     SELECT jsonb_build_object('id', mm.id, 'title', mm.title, 'status', mm.status, 'sent_at', mm.sent_at,
       'send_at', mm.send_at, 'recipient_count', mm.recipient_count, 'created_at', mm.created_at,
       'przeczytane', (SELECT count(*) FROM public.mb_message_recipients r WHERE r.message_id = mm.id AND r.read_at IS NOT NULL)) AS j,
       COALESCE(mm.sent_at, mm.send_at, mm.created_at) AS sort
     FROM public.mb_messages mm
     WHERE mm.target->>'kind' = 'grupa' AND mm.target->>'group_id' = p_group::text
     ORDER BY COALESCE(mm.sent_at, mm.send_at, mm.created_at) DESC LIMIT 50) x), '[]'::jsonb))
$agd$;

CREATE OR REPLACE FUNCTION public.mb_admin_history(p_action text DEFAULT NULL, p_days int DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ah$
WITH it AS (
  SELECT jsonb_build_object('at', l.at, 'actor', l.actor, 'action', l.action, 'object_type', l.object_type,
    'object_id', l.object_id, 'summary', l.summary, 'anonymized', l.anonymized) AS j, l.at
  FROM public.mb_log l
  WHERE (p_action IS NULL OR l.action = p_action)
    AND (p_days IS NULL OR l.at > now() - make_interval(days => p_days))
  ORDER BY l.at DESC LIMIT 300
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.at DESC) FROM it), '[]'::jsonb),
  'akcje', COALESCE((SELECT jsonb_agg(DISTINCT a.action ORDER BY a.action) FROM public.mb_log a), '[]'::jsonb))
$ah$;

-- Podgląd odbiorców: same adresy — imiona dokłada warstwa funkcji (konta Base44).
CREATE OR REPLACE FUNCTION public.mb_admin_assignment_preview(p_target jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ap$
SELECT COALESCE(jsonb_agg(e.email ORDER BY e.email), '[]'::jsonb) FROM public.mb_resolve_recipients(p_target) e
$ap$;

-- ============ PANEL: ZAPISY ============
CREATE OR REPLACE FUNCTION public.mb_admin_assignment_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $asv$
DECLARE
  mat uuid := NULLIF(p->>'material_id','')::uuid;
  col uuid := NULLIF(p->>'collection_id','')::uuid;
  kind text := CASE WHEN p->>'target_kind' = 'grupa' THEN 'grupa' ELSE 'osoba' END;
  tgt text := NULLIF(lower(btrim(COALESCE(p->>'target_email',''))), '');
  gid uuid := NULLIF(p->>'group_id','')::uuid;
  gmode text := NULLIF(p->>'group_mode','');
  snap text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'snapshot_emails','[]')) x), '{}'::text[]);
  addx text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'exceptions_add','[]')) x), '{}'::text[]);
  dropx text[] := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'exceptions_drop','[]')) x), '{}'::text[]);
  vf timestamptz := NULLIF(p->>'visible_from','')::timestamptz;
  vt timestamptz := NULLIF(p->>'visible_to','')::timestamptz;
  who text := COALESCE(NULLIF(p->>'actor',''), 'system');
  tgtjson jsonb;
  newid uuid;
  rec int;
BEGIN
  IF (mat IS NULL) = (col IS NULL) THEN RAISE EXCEPTION 'material albo kolekcja, nie oba'; END IF;
  IF kind = 'osoba' THEN
    IF tgt IS NULL OR position('@' in tgt) = 0 THEN RAISE EXCEPTION 'brak osoby'; END IF;
    gid := NULL; gmode := NULL; snap := '{}'; addx := '{}'; dropx := '{}';
    tgtjson := jsonb_build_object('kind','osoba','emails', jsonb_build_array(tgt));
  ELSE
    IF gid IS NULL THEN RAISE EXCEPTION 'brak grupy'; END IF;
    gmode := CASE WHEN gmode = 'TYLKO_OBECNI' THEN 'TYLKO_OBECNI' ELSE 'OBECNI_I_PRZYSZLI' END;
    tgt := NULL;
    IF gmode = 'TYLKO_OBECNI' THEN
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(m.client_email))), '{}'::text[])
        INTO snap FROM public.mb_group_members m WHERE m.group_id = gid;
    ELSE
      snap := '{}';
    END IF;
    tgtjson := jsonb_build_object('kind','grupa','group_id', gid, 'group_mode', gmode,
      'snapshot_emails', to_jsonb(snap), 'exceptions_add', to_jsonb(addx), 'exceptions_drop', to_jsonb(dropx));
  END IF;

  INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, group_id, group_mode,
    snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
  VALUES (mat, col, kind, tgt, gid, gmode, snap, addx, dropx,
    NULLIF(p->>'note',''), vf, vt, who)
  RETURNING id INTO newid;

  SELECT count(*) INTO rec FROM public.mb_resolve_recipients(tgtjson) r;
  RETURN jsonb_build_object('id', newid, 'count', rec);
END $asv$;

CREATE OR REPLACE FUNCTION public.mb_admin_assignment_bulk(p_material uuid, p_emails text[], p_note text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $ab$
WITH ins AS (
  INSERT INTO public.mb_assignments (material_id, target_kind, target_email, note, visible_from, visible_to, created_by)
  SELECT p_material, 'osoba', lower(btrim(e)), p_note, p_from, p_to, COALESCE(p_actor, 'system')
    FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
  RETURNING 1
)
SELECT count(*)::int FROM ins
$ab$;

CREATE OR REPLACE FUNCTION public.mb_admin_assignment_revoke(p_id uuid DEFAULT NULL, p_material uuid DEFAULT NULL,
  p_collection uuid DEFAULT NULL, p_group uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ar$
DECLARE k int;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE public.mb_assignments SET revoked_at = now() WHERE id = p_id AND revoked_at IS NULL;
    GET DIAGNOSTICS k = ROW_COUNT;
    RETURN k;
  END IF;
  IF p_group IS NULL OR (p_material IS NULL AND p_collection IS NULL) THEN RETURN 0; END IF;
  UPDATE public.mb_assignments SET revoked_at = now()
   WHERE revoked_at IS NULL AND group_id = p_group
     AND ((p_material IS NOT NULL AND material_id = p_material)
       OR (p_collection IS NOT NULL AND collection_id = p_collection));
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $ar$;

CREATE OR REPLACE FUNCTION public.mb_admin_group_members(p_group uuid, p_emails text[], p_add boolean, p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $agm$
DECLARE k int;
BEGIN
  IF p_group IS NULL THEN RETURN 0; END IF;
  IF p_add THEN
    INSERT INTO public.mb_group_members (group_id, client_email, added_by)
    SELECT p_group, lower(btrim(e)), COALESCE(p_actor, 'system') FROM unnest(p_emails) AS e
     WHERE lower(btrim(e)) <> ''
    ON CONFLICT (group_id, client_email) DO NOTHING;
  ELSE
    DELETE FROM public.mb_group_members m WHERE m.group_id = p_group
      AND m.client_email IN (SELECT lower(btrim(e)) FROM unnest(p_emails) AS e);
  END IF;
  GET DIAGNOSTICS k = ROW_COUNT;
  RETURN k;
END $agm$;

-- ============ PANEL: MATERIAŁY (ZAPIS) ============
-- Dodanie albo zmiana materiału. Kolumny właściwe dla rodzaju ustawia baza, więc warstwa
-- funkcji nie skleja SQL-a — wysyła tylko wartości.
CREATE OR REPLACE FUNCTION public.mb_admin_material_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  k text := p->>'kind';
  vurl text := NULLIF(btrim(COALESCE(p->>'external_url','')), '');
  vprov text := NULLIF(p->>'video_provider','');
  vid text := NULLIF(p->>'video_id','');
  vhtml text := NULLIF(p->>'body_html','');
  vkeep boolean := COALESCE((p->>'keep_video')::boolean, false);
  out_id uuid;
BEGIN
  IF k IS NULL OR k NOT IN ('AUDIO','WIDEO','PDF','LINK','TEKST') THEN RAISE EXCEPTION 'nieznany rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;

  IF k = 'LINK' THEN
    IF vurl IS NULL OR vurl NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu'; END IF;
    vprov := NULL; vid := NULL; vhtml := NULL;
  ELSIF k = 'WIDEO' THEN
    vurl := NULL; vhtml := NULL;
    IF vkeep THEN vprov := NULL; vid := NULL; END IF;
  ELSIF k = 'TEKST' THEN
    IF vhtml IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
    vurl := NULL; vprov := NULL; vid := NULL;
  ELSE
    vurl := NULL; vprov := NULL; vid := NULL; vhtml := NULL;
  END IF;

  IF mid IS NULL THEN
    IF k IN ('PDF','AUDIO') THEN RAISE EXCEPTION 'najpierw plik'; END IF;
    INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download,
      source, external_url, video_provider, video_id, body_html, created_by)
    VALUES (k, btrim(p->>'title'), NULLIF(p->>'description',''), NULLIF(p->>'stage',''),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      NULLIF(p->>'duration_s','')::int, NULLIF(p->>'pages','')::int,
      COALESCE((p->>'allow_download')::boolean, false), NULLIF(p->>'source',''),
      vurl, vprov, vid, vhtml, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_materials SET
      kind = k, title = btrim(p->>'title'), description = NULLIF(p->>'description',''),
      stage = NULLIF(p->>'stage',''),
      tags = COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      duration_s = NULLIF(p->>'duration_s','')::int, pages = NULLIF(p->>'pages','')::int,
      allow_download = COALESCE((p->>'allow_download')::boolean, false), source = NULLIF(p->>'source',''),
      external_url = vurl,
      video_provider = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_provider ELSE vprov END,
      video_id = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.video_id ELSE vid END,
      body_html = vhtml, updated_at = now()
    WHERE id = mid AND deleted_at IS NULL
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $ms$;

-- Rejestracja pliku po sprawdzeniu sygnatury i rozmiaru (samo wgranie zostaje w warstwie funkcji).
CREATE OR REPLACE FUNCTION public.mb_admin_material_register(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mrg$
DECLARE out_id uuid;
BEGIN
  IF p->>'kind' IS NULL OR p->>'kind' NOT IN ('AUDIO','PDF') THEN RAISE EXCEPTION 'zly rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;
  INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, created_by)
  VALUES (p->>'kind', btrim(p->>'title'), p->>'file_key', p->>'file_name',
    NULLIF(p->>'file_size','')::bigint, COALESCE((p->>'pdf_js')::boolean, false), NULLIF(p->>'actor',''))
  RETURNING id INTO out_id;
  RETURN jsonb_build_object('id', out_id);
END $mrg$;

-- Ile osób straci dostęp po usunięciu materiału — liczone w bazie, bez pętli po przydziałach.
CREATE OR REPLACE FUNCTION public.mb_admin_material_impact(p_material uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mi$
WITH a AS (SELECT * FROM public.mb_assignments WHERE material_id = p_material AND revoked_at IS NULL),
pp AS (SELECT DISTINCT e.email FROM a, LATERAL public.mb_resolve_recipients(
   CASE WHEN a.target_kind = 'osoba' THEN jsonb_build_object('kind','osoba','emails', jsonb_build_array(a.target_email))
   ELSE jsonb_build_object('kind','grupa','group_id', a.group_id, 'group_mode', a.group_mode,
     'snapshot_emails', to_jsonb(a.snapshot_emails), 'exceptions_add', to_jsonb(a.exceptions_add),
     'exceptions_drop', to_jsonb(a.exceptions_drop)) END) e)
SELECT jsonb_build_object('osoby', (SELECT count(*) FROM pp), 'przydzialy', (SELECT count(*) FROM a))
$mi$;

-- Przydziały materiału/kolekcji: odbiorcy i grupy liczone od razu w bazie.
CREATE OR REPLACE FUNCTION public.mb_admin_assignments_of(p_material uuid DEFAULT NULL, p_collection uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ao$
WITH a AS (
  SELECT x.* FROM public.mb_assignments x
   WHERE (p_material IS NOT NULL AND x.material_id = p_material)
      OR (p_collection IS NOT NULL AND x.collection_id = p_collection)
   ORDER BY x.created_at DESC LIMIT 500
),
pp AS (
  SELECT a.id, e.email FROM a, LATERAL public.mb_resolve_recipients(
    CASE WHEN a.target_kind = 'osoba' THEN jsonb_build_object('kind','osoba','emails', jsonb_build_array(a.target_email))
    ELSE jsonb_build_object('kind','grupa','group_id', a.group_id, 'group_mode', a.group_mode,
      'snapshot_emails', to_jsonb(a.snapshot_emails), 'exceptions_add', to_jsonb(a.exceptions_add),
      'exceptions_drop', to_jsonb(a.exceptions_drop)) END) e
   WHERE a.revoked_at IS NULL
),
it AS (
  SELECT jsonb_build_object('id', a.id, 'target_kind', a.target_kind, 'target_email', a.target_email,
    'group_id', a.group_id, 'group_mode', a.group_mode, 'note', a.note,
    'visible_from', a.visible_from, 'visible_to', a.visible_to, 'created_at', a.created_at, 'revoked_at', a.revoked_at,
    'people', CASE WHEN a.revoked_at IS NULL THEN (SELECT count(*) FROM pp WHERE pp.id = a.id) ELSE 0 END,
    'sample', CASE WHEN a.revoked_at IS NULL THEN COALESCE((SELECT jsonb_agg(x.email ORDER BY x.email) FROM
       (SELECT DISTINCT email FROM pp WHERE pp.id = a.id ORDER BY email LIMIT 5) x), '[]'::jsonb) ELSE '[]'::jsonb END,
    'group', CASE WHEN a.group_id IS NULL THEN NULL ELSE
       (SELECT jsonb_build_object('id', g.id, 'name', g.name, 'color', g.color, 'kind', g.kind)
          FROM public.mb_groups g WHERE g.id = a.group_id) END) AS j,
    a.created_at
  FROM a
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.created_at DESC) FROM it), '[]'::jsonb),
  'odbiorcy', (SELECT count(DISTINCT email) FROM pp),
  'otwarte', CASE WHEN p_material IS NULL THEN NULL ELSE
    (SELECT count(*) FROM public.mb_material_state s WHERE s.material_id = p_material AND s.opened_at IS NOT NULL) END)
$ao$;

-- ============ PANEL: WIADOMOŚCI (ZAPIS) ============
CREATE OR REPLACE FUNCTION public.mb_admin_message_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mss$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  tgt jsonb := COALESCE(p->'target','{}'::jsonb);
  snap jsonb;
  cnt int;
  out_id uuid;
  st text := CASE WHEN p->>'status' = 'ZAPLANOWANA' THEN 'ZAPLANOWANA' ELSE 'SZKIC' END;
  snd timestamptz := NULLIF(p->>'send_at','')::timestamptz;
BEGIN
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF st = 'ZAPLANOWANA' AND snd IS NULL THEN RAISE EXCEPTION 'brak terminu'; END IF;

  -- Snapshot „tylko obecni" powstaje tu, w tej samej transakcji co zapis.
  IF tgt->>'kind' = 'grupa' AND tgt->>'group_mode' = 'TYLKO_OBECNI' THEN
    SELECT COALESCE(to_jsonb(array_agg(DISTINCT lower(btrim(m.client_email)))), '[]'::jsonb) INTO snap
      FROM public.mb_group_members m WHERE m.group_id = NULLIF(tgt->>'group_id','')::uuid;
    tgt := jsonb_set(tgt, '{snapshot_emails}', COALESCE(snap, '[]'::jsonb));
  END IF;

  SELECT count(*) INTO cnt FROM public.mb_resolve_recipients(tgt) r;

  IF mid IS NULL THEN
    INSERT INTO public.mb_messages (title, body_html, email_mode, attached_material_id, attached_collection_id,
      target, recipient_count, status, send_at, created_by)
    VALUES (NULLIF(p->>'title',''), p->>'body_html', COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      NULLIF(p->>'attached_material_id','')::uuid, NULLIF(p->>'attached_collection_id','')::uuid,
      tgt, cnt, st, snd, NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_messages SET title = NULLIF(p->>'title',''), body_html = p->>'body_html',
      email_mode = COALESCE(NULLIF(p->>'email_mode',''), 'BRAK'),
      attached_material_id = NULLIF(p->>'attached_material_id','')::uuid,
      attached_collection_id = NULLIF(p->>'attached_collection_id','')::uuid,
      target = tgt, recipient_count = cnt, status = st, send_at = snd, updated_at = now()
    WHERE id = mid AND status IN ('SZKIC','ZAPLANOWANA')
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id, 'count', cnt);
END $mss$;

-- Atomowe przejęcie wiadomości (ZAPLANOWANA → WYSYLANIE). p_promote podnosi szkic na „teraz".
CREATE OR REPLACE FUNCTION public.mb_admin_message_claim(p_id uuid, p_promote boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mcl$
DECLARE r record;
BEGIN
  IF p_id IS NULL THEN RETURN NULL; END IF;
  IF p_promote THEN
    UPDATE public.mb_messages SET status = 'ZAPLANOWANA', send_at = now(), updated_at = now()
     WHERE id = p_id AND status = 'SZKIC';
  END IF;
  UPDATE public.mb_messages
     SET status = 'WYSYLANIE', idem_key = COALESCE(idem_key, 'send:' || id::text), updated_at = now()
   WHERE id = p_id AND status = 'ZAPLANOWANA'
  RETURNING id, title, body_html, email_mode, attached_material_id, attached_collection_id, target INTO r;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'email_mode', r.email_mode,
    'attached_material_id', r.attached_material_id, 'attached_collection_id', r.attached_collection_id, 'target', r.target);
END $mcl$;

-- Domknięcie wysyłki: odbiorcy, status i przydział dołączonego materiału w jednym wywołaniu.
CREATE OR REPLACE FUNCTION public.mb_admin_message_finish(p_id uuid, p_emails text[], p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mfn$
DECLARE
  m record;
  n int := 0;
  who text := COALESCE(NULLIF(p_actor,''), 'system');
BEGIN
  IF p_id IS NULL THEN RETURN 0; END IF;
  SELECT target, attached_material_id, attached_collection_id INTO m FROM public.mb_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  n := COALESCE(array_length(p_emails, 1), 0);

  IF n > 0 THEN
    INSERT INTO public.mb_message_recipients (message_id, client_email)
    SELECT p_id, lower(btrim(e)) FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
    ON CONFLICT (message_id, client_email) DO NOTHING;
  END IF;

  UPDATE public.mb_messages SET status = 'WYSLANA', sent_at = now(), recipient_count = n, updated_at = now()
   WHERE id = p_id AND status = 'WYSYLANIE';

  IF m.attached_material_id IS NOT NULL OR m.attached_collection_id IS NOT NULL THEN
    IF m.target->>'kind' = 'grupa' AND NULLIF(m.target->>'group_id','') IS NOT NULL THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, group_id, group_mode,
        snapshot_emails, exceptions_add, exceptions_drop, note, created_by)
      VALUES (m.attached_material_id, m.attached_collection_id, 'grupa', (m.target->>'group_id')::uuid,
        COALESCE(m.target->>'group_mode', 'OBECNI_I_PRZYSZLI'),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'snapshot_emails','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_add','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_drop','[]')) x), '{}'::text[]),
        'dołączone do wiadomości', who);
    ELSIF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT m.attached_material_id, m.attached_collection_id, 'osoba', lower(btrim(e)), 'dołączone do wiadomości', who
        FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> '';
    END IF;
  END IF;
  RETURN n;
END $mfn$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_edit(p_id uuid, p_title text, p_body_html text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $med$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET title = NULLIF(p_title,''), body_html = p_body_html, updated_at = now()
   WHERE id = p_id AND status = 'WYSLANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $med$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_cancel(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mca$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET status = 'SZKIC', send_at = NULL, updated_at = now()
   WHERE id = p_id AND status = 'ZAPLANOWANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mca$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_delete(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mdl$
DECLARE k int;
BEGIN
  DELETE FROM public.mb_messages WHERE id = p_id AND status IN ('SZKIC','WYCOFANA');
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mdl$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_withdraw(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mwd$
DECLARE k int;
BEGIN
  UPDATE public.mb_messages SET status = 'WYCOFANA', withdrawn_at = now(), updated_at = now()
   WHERE id = p_id AND status = 'WYSLANA';
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mwd$;

-- Limit 20 wysyłek na godzinę — jedno zapytanie zamiast osobnego odczytu.
CREATE OR REPLACE FUNCTION public.mb_admin_message_send_rate() RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mrt$
SELECT count(*)::int FROM public.mb_messages WHERE sent_at > now() - interval '1 hour'
$mrt$;

-- Wiadomość + adresy nieprzeczytanych (do ponownego powiadomienia) jednym wywołaniem.
CREATE OR REPLACE FUNCTION public.mb_admin_message_notify(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mnt$
SELECT jsonb_build_object(
  'message', (SELECT jsonb_build_object('id', m.id, 'title', m.title, 'body_html', m.body_html, 'email_mode', m.email_mode)
     FROM public.mb_messages m WHERE m.id = p_id AND m.status = 'WYSLANA'),
  'emails', COALESCE((SELECT jsonb_agg(x.email) FROM
     (SELECT r.client_email AS email FROM public.mb_message_recipients r
       WHERE r.message_id = p_id AND r.read_at IS NULL AND r.hidden_at IS NULL LIMIT 500) x), '[]'::jsonb),
  'niedawno', EXISTS (SELECT 1 FROM public.mb_log l WHERE l.action = 'powiadomienie_ponowne'
     AND l.object_id = p_id::text AND l.at > now() - interval '24 hours'))
$mnt$;

CREATE OR REPLACE FUNCTION public.mb_admin_message_stats(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mst$
SELECT COALESCE(jsonb_agg(jsonb_build_object('client_email', x.client_email, 'delivered_at', x.delivered_at,
  'read_at', x.read_at, 'hidden_at', x.hidden_at) ORDER BY x.read_at DESC NULLS LAST), '[]'::jsonb)
FROM (SELECT * FROM public.mb_message_recipients WHERE message_id = p_id ORDER BY read_at DESC NULLS LAST LIMIT 500) x
$mst$;

-- ============ PANEL: SZABLONY ============
CREATE OR REPLACE FUNCTION public.mb_admin_templates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $mtl$
SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'title', t.title,
  'body_html', t.body_html, 'created_at', t.created_at) ORDER BY t.name), '[]'::jsonb)
FROM public.mb_templates t
$mtl$;

CREATE OR REPLACE FUNCTION public.mb_admin_template_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mts$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  out_id uuid;
BEGIN
  IF NULLIF(btrim(COALESCE(p->>'name','')), '') IS NULL THEN RAISE EXCEPTION 'brak nazwy'; END IF;
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF mid IS NULL THEN
    INSERT INTO public.mb_templates (name, title, body_html, created_by)
    VALUES (btrim(p->>'name'), NULLIF(p->>'title',''), p->>'body_html', NULLIF(p->>'actor',''))
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.mb_templates SET name = btrim(p->>'name'), title = NULLIF(p->>'title',''), body_html = p->>'body_html'
     WHERE id = mid RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $mts$;

CREATE OR REPLACE FUNCTION public.mb_admin_template_delete(p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mtd$
DECLARE k int;
BEGIN
  DELETE FROM public.mb_templates WHERE id = p_id;
  GET DIAGNOSTICS k = ROW_COUNT; RETURN k > 0;
END $mtd$;

-- ============ HISTORIA ZMIAN (ZAPIS) ============
CREATE OR REPLACE FUNCTION public.mb_log_add(p_actor text, p_action text, p_object_type text,
  p_object_id text, p_summary text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $lga$
INSERT INTO public.mb_log (actor, action, object_type, object_id, summary)
VALUES (left(COALESCE(p_actor, 'system'), 200), left(p_action, 60), p_object_type, p_object_id, left(p_summary, 500))
$lga$;

-- ============ USTAWIENIA APLIKACJI (wspólne, nie mb_*) ============
-- Ten sam odczyt co getSettingsFast, ale przez PostgREST (Management API to ~1,5 s na zapytanie).
-- Korzystają z niego wszystkie funkcje czytające Dane firmy i ustawienia SMTP.
CREATE OR REPLACE FUNCTION public.app_settings_get(p_keys text[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $asg$
SELECT COALESCE(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
FROM public.app_settings s WHERE s.key = ANY(p_keys)
$asg$;

-- ============ DOSTĘP: wyłącznie serwer ============
REVOKE ALL ON FUNCTION public.app_settings_get(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_settings_get(text[]) TO service_role;
REVOKE ALL ON FUNCTION public.mb_lib_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_space() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_library(text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_messages(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_bundle(text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_material_complete(text, boolean, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_message_flag(text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_materials(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_collections() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_groups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_dashboard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_clients_mb() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_client_mb(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_group_detail(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_history(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_preview(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_bulk(uuid, text[], text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignment_revoke(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_group_members(uuid, text[], boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_register(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_impact(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assignments_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_claim(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_edit(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_withdraw(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_send_rate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_notify(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_templates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_template_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_template_delete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_log_add(text, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mb_lib_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_space() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_library(text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_messages(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_bundle(text, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_material_complete(text, boolean, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_message_flag(text, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_materials(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_collections() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_groups() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_dashboard() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_clients_mb() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_client_mb(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_group_detail(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_history(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_preview(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_bulk(uuid, text[], text, timestamptz, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignment_revoke(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_group_members(uuid, text[], boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_register(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_impact(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assignments_of(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_claim(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_edit(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_cancel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_withdraw(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_send_rate() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_notify(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_stats(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_templates() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_template_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_template_delete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_log_add(text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;

// Kontrola po migracji: każda nowa funkcja jest SECURITY DEFINER z ustawionym search_path,
// bez EXECUTE dla anon i authenticated.
export const CHECKPOINT_RPC_SQL = `
SELECT p.proname AS funkcja,
       p.prosecdef AS security_definer,
       (p.proconfig IS NOT NULL) AS search_path_ustawiony,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'mb\\_%'
ORDER BY p.proname`;