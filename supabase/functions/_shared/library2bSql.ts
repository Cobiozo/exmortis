// ETAP 2B — WŁASNE WIDEO + KILKA ZAŁĄCZNIKÓW W JEDNEJ WIADOMOŚCI.
// Wszystko DODAJĄCE: nowe kolumny, nowa tabela, przedefiniowane funkcje (CREATE OR REPLACE).
// Żadna istniejąca tabela nie jest kasowana, żadne dane nie są usuwane — poza jednorazowym
// przepisaniem starych kolumn attached_* do nowej tabeli (kopiowanie, nie przenoszenie).
// Zasady jak w 2A: SECURITY DEFINER, search_path = '', EXECUTE wyłącznie dla service_role.

export const SCHEMA_2B_SQL = `
-- ============ 1. USTAWIENIA: domeny własnych plików wideo ============
ALTER TABLE public.mb_settings ADD COLUMN IF NOT EXISTS video_domains text[] NOT NULL DEFAULT '{}';

-- ============ 2. MATERIAŁY: trzecie źródło wideo ============
-- server_url = adres pliku na serwerze właściciela (tylko z domen wpisanych w ustawieniach).
ALTER TABLE public.mb_materials ADD COLUMN IF NOT EXISTS server_url text
  CHECK (server_url IS NULL OR (server_url ~ '^https://' AND length(server_url) <= 500));

ALTER TABLE public.mb_materials DROP CONSTRAINT IF EXISTS mb_materials_video_provider_check;
ALTER TABLE public.mb_materials ADD CONSTRAINT mb_materials_video_provider_check
  CHECK (video_provider IS NULL OR video_provider IN ('youtube','vimeo','bunny','plik','serwer'));

-- Rodzaj decyduje o źródle treści. WIDEO ma teraz TRZY wykluczające się źródła.
ALTER TABLE public.mb_materials DROP CONSTRAINT IF EXISTS mb_materials_check;
ALTER TABLE public.mb_materials ADD CONSTRAINT mb_materials_zrodlo_check CHECK (CASE kind
  WHEN 'AUDIO' THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'PDF'   THEN file_key IS NOT NULL AND external_url IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'WIDEO' THEN external_url IS NULL AND body_html IS NULL AND (
       (video_provider IN ('youtube','vimeo','bunny') AND video_id IS NOT NULL AND file_key IS NULL AND server_url IS NULL)
    OR (video_provider = 'plik'   AND file_key IS NOT NULL AND video_id IS NULL AND server_url IS NULL)
    OR (video_provider = 'serwer' AND server_url IS NOT NULL AND file_key IS NULL AND video_id IS NULL))
  WHEN 'LINK'  THEN file_key IS NULL AND external_url IS NOT NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NULL AND server_url IS NULL
  WHEN 'TEKST' THEN file_key IS NULL AND external_url IS NULL AND video_provider IS NULL AND video_id IS NULL AND body_html IS NOT NULL AND server_url IS NULL
END);

-- ============ 3. ZAŁĄCZNIKI WIADOMOŚCI ============
-- Dokładnie jedno z dwóch: materiał albo kolekcja. Do 10 pozycji na wiadomość (pilnuje funkcja zapisu).
CREATE TABLE IF NOT EXISTS public.mb_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.mb_materials(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.mb_collections(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0 CHECK (position >= 0),
  CHECK ((material_id IS NOT NULL) <> (collection_id IS NOT NULL)),
  UNIQUE (message_id, material_id),
  UNIQUE (message_id, collection_id),
  UNIQUE (message_id, position)
);
CREATE INDEX IF NOT EXISTS mb_msg_att_msg ON public.mb_message_attachments (message_id, position);

-- Stare kolumny attached_* zostają. Istniejące wartości przepisujemy raz do nowej tabeli.
INSERT INTO public.mb_message_attachments (message_id, material_id, collection_id, position)
SELECT m.id, m.attached_material_id, m.attached_collection_id, 0
  FROM public.mb_messages m
 WHERE m.attached_material_id IS NOT NULL OR m.attached_collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

DO $x$ BEGIN
  ALTER TABLE public.mb_message_attachments ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.mb_message_attachments FROM PUBLIC, anon, authenticated;
END $x$;
`;

export const RPC_2B_SQL = `
-- ============ USTAWIENIA (z domenami wideo) ============
CREATE OR REPLACE FUNCTION public.mb_lib_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $ls$
  SELECT COALESCE(
    (SELECT jsonb_build_object('library_mode', s.library_mode, 'messages_mode', s.messages_mode,
       'email_notify', s.email_notify, 'whatsapp', s.whatsapp, 'space_limit_mb', s.space_limit_mb,
       'video_domains', s.video_domains)
       FROM public.mb_settings s WHERE s.id = 1),
    jsonb_build_object('library_mode','off','messages_mode','off','email_notify',false,'whatsapp',NULL,
       'space_limit_mb',5120,'video_domains','[]'::jsonb))
$ls$;

-- Zapis ustawień modułu (jedno miejsce, bez SQL-a w warstwie funkcji).
CREATE OR REPLACE FUNCTION public.mb_admin_settings_save(p jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ssv$
DECLARE
  lib text := CASE WHEN p->>'library_mode' IN ('off','admin','on') THEN p->>'library_mode' ELSE 'off' END;
  msg text := CASE WHEN p->>'messages_mode' IN ('off','admin','on') THEN p->>'messages_mode' ELSE 'off' END;
  wa text := NULLIF(btrim(COALESCE(p->>'whatsapp','')), '');
  lim int := LEAST(1048576, GREATEST(64, COALESCE(NULLIF(p->>'space_limit_mb','')::int, 5120)));
  dom text[] := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM jsonb_array_elements_text(COALESCE(p->'video_domains','[]')) x
     WHERE lower(btrim(x)) <> ''), '{}'::text[]);
BEGIN
  IF wa IS NOT NULL AND wa !~ '^https://wa\\.me/[0-9]{6,20}$' THEN RAISE EXCEPTION 'zly whatsapp'; END IF;
  UPDATE public.mb_settings SET library_mode = lib, messages_mode = msg,
    email_notify = COALESCE((p->>'email_notify')::boolean, false), whatsapp = wa,
    space_limit_mb = lim, video_domains = dom, updated_at = now() WHERE id = 1;
  RETURN true;
END $ssv$;

-- ============ KLIENT: OTWARCIE MATERIAŁU (dochodzi adres z serwera) ============
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
  SELECT mm.id, mm.title, mm.kind, mm.file_key, mm.external_url, mm.video_provider, mm.video_id,
         mm.server_url, mm.body_html, mm.allow_download
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
    'video_provider', m.video_provider, 'video_id', m.video_id, 'server_url', m.server_url,
    'body_html', m.body_html, 'allow_download', m.allow_download));
END $co$;

-- ============ KLIENT: WIADOMOŚCI (wszystkie załączniki) ============
CREATE OR REPLACE FUNCTION public.mb_client_messages(p_email text, p_preview boolean DEFAULT false)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $cm$
WITH me AS (SELECT lower(btrim(COALESCE(p_email,''))) AS mail),
r AS (
  SELECT m.id, m.title, m.body_html, m.sent_at, rr.read_at
    FROM public.mb_message_recipients rr
    JOIN public.mb_messages m ON m.id = rr.message_id
   WHERE rr.client_email = (SELECT mail FROM me) AND m.status = 'WYSLANA' AND rr.hidden_at IS NULL
   ORDER BY m.sent_at DESC NULLS LAST LIMIT 100
),
att AS (
  SELECT a.message_id,
         jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
           'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title,
           'position', a.position) ORDER BY a.position) AS j
    FROM public.mb_message_attachments a
    LEFT JOIN public.mb_materials mm ON mm.id = a.material_id AND mm.deleted_at IS NULL
    LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id AND cc.deleted_at IS NULL
   GROUP BY a.message_id
),
it AS (
  SELECT jsonb_build_object('id', r.id, 'title', r.title, 'body_html', r.body_html, 'sent_at', r.sent_at,
    'read_at', r.read_at, 'attachments', COALESCE(att.j, '[]'::jsonb)) AS j, r.sent_at, r.read_at
  FROM r LEFT JOIN att ON att.message_id = r.id
)
SELECT jsonb_build_object(
  'items', COALESCE((SELECT jsonb_agg(it.j ORDER BY it.sent_at DESC NULLS LAST) FROM it), '[]'::jsonb),
  'unread', CASE WHEN p_preview THEN 0 ELSE (SELECT count(*) FROM it WHERE it.read_at IS NULL) END)
$cm$;

-- ============ PANEL: MATERIAŁY (trzy źródła wideo) ============
CREATE OR REPLACE FUNCTION public.mb_admin_material_save(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $ms$
DECLARE
  mid uuid := NULLIF(p->>'id','')::uuid;
  k text := p->>'kind';
  vsrc text := NULLIF(p->>'video_source','');
  vurl text := NULLIF(btrim(COALESCE(p->>'external_url','')), '');
  vsrv text := NULLIF(btrim(COALESCE(p->>'server_url','')), '');
  vprov text := NULLIF(p->>'video_provider','');
  vid text := NULLIF(p->>'video_id','');
  vhtml text := NULLIF(p->>'body_html','');
  vkeep boolean := COALESCE((p->>'keep_video')::boolean, false);
  -- Zmiana źródła wideo z pliku na adres/link: kolumny pliku muszą zostać puste (reguła spójności).
  clearfile boolean := false;
  out_id uuid;
BEGIN
  IF k IS NULL OR k NOT IN ('AUDIO','WIDEO','PDF','LINK','TEKST') THEN RAISE EXCEPTION 'nieznany rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;

  IF k = 'LINK' THEN
    IF vurl IS NULL OR vurl NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu'; END IF;
    vprov := NULL; vid := NULL; vhtml := NULL; vsrv := NULL;
  ELSIF k = 'WIDEO' THEN
    vurl := NULL; vhtml := NULL;
    IF vkeep THEN
      vprov := NULL; vid := NULL; vsrv := NULL;
    ELSIF vsrc = 'serwer' THEN
      clearfile := true;
      IF vsrv IS NULL OR vsrv NOT LIKE 'https://%' THEN RAISE EXCEPTION 'brak adresu pliku'; END IF;
      vprov := 'serwer'; vid := NULL;
    ELSIF vsrc = 'plik' THEN
      vprov := 'plik'; vid := NULL; vsrv := NULL;
    ELSE
      vsrv := NULL; clearfile := true;
      IF vprov IS NULL OR vid IS NULL THEN RAISE EXCEPTION 'brak zrodla wideo'; END IF;
    END IF;
  ELSIF k = 'TEKST' THEN
    IF vhtml IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
    vurl := NULL; vprov := NULL; vid := NULL; vsrv := NULL;
  ELSE
    vurl := NULL; vprov := NULL; vid := NULL; vhtml := NULL; vsrv := NULL;
  END IF;

  IF mid IS NULL THEN
    IF k IN ('PDF','AUDIO') THEN RAISE EXCEPTION 'najpierw plik'; END IF;
    INSERT INTO public.mb_materials (kind, title, description, stage, tags, duration_s, pages, allow_download,
      source, external_url, video_provider, video_id, server_url, body_html, created_by)
    VALUES (k, btrim(p->>'title'), NULLIF(p->>'description',''), NULLIF(p->>'stage',''),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p->'tags','[]')) x), '{}'::text[]),
      NULLIF(p->>'duration_s','')::int, NULLIF(p->>'pages','')::int,
      COALESCE((p->>'allow_download')::boolean, false), NULLIF(p->>'source',''),
      vurl, vprov, vid, vsrv, vhtml, NULLIF(p->>'actor',''))
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
      server_url = CASE WHEN k = 'WIDEO' AND vkeep THEN public.mb_materials.server_url ELSE vsrv END,
      file_key = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_key END,
      file_name = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_name END,
      file_size = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.file_size END,
      prev_file_key = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_key END,
      prev_file_name = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_name END,
      prev_file_size = CASE WHEN clearfile THEN NULL ELSE public.mb_materials.prev_file_size END,
      body_html = vhtml, updated_at = now()
    WHERE id = mid AND deleted_at IS NULL
    RETURNING id INTO out_id;
    IF out_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', out_id);
END $ms$;

-- Rejestracja pliku: PDF, AUDIO albo WIDEO (plik wideo).
CREATE OR REPLACE FUNCTION public.mb_admin_material_register(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mrg$
DECLARE out_id uuid;
BEGIN
  IF p->>'kind' IS NULL OR p->>'kind' NOT IN ('AUDIO','PDF','WIDEO') THEN RAISE EXCEPTION 'zly rodzaj'; END IF;
  IF NULLIF(btrim(COALESCE(p->>'title','')), '') IS NULL THEN RAISE EXCEPTION 'brak tytulu'; END IF;
  INSERT INTO public.mb_materials (kind, title, file_key, file_name, file_size, pdf_js_warning, video_provider, created_by)
  VALUES (p->>'kind', btrim(p->>'title'), p->>'file_key', p->>'file_name',
    NULLIF(p->>'file_size','')::bigint, COALESCE((p->>'pdf_js')::boolean, false),
    CASE WHEN p->>'kind' = 'WIDEO' THEN 'plik' ELSE NULL END, NULLIF(p->>'actor',''))
  RETURNING id INTO out_id;
  RETURN jsonb_build_object('id', out_id);
END $mrg$;

-- Lista materiałów: dokładamy źródło wideo i obecność pliku.
CREATE OR REPLACE FUNCTION public.mb_admin_materials(p_kind text DEFAULT NULL, p_q text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $am$
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id', m.id, 'title', m.title, 'kind', m.kind, 'description', m.description, 'stage', m.stage, 'tags', m.tags,
  'file_version', m.file_version, 'file_size', m.file_size, 'prev_file_size', m.prev_file_size,
  'prev_file_name', m.prev_file_name, 'pdf_js_warning', m.pdf_js_warning, 'external_url', m.external_url,
  'video_provider', m.video_provider, 'video_id', m.video_id, 'server_url', m.server_url,
  'file_name', m.file_name, 'has_file', (m.file_key IS NOT NULL),
  'duration_s', m.duration_s, 'pages', m.pages,
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

-- ============ PANEL: WIADOMOŚĆ Z WIELOMA ZAŁĄCZNIKAMI ============
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
  att jsonb := COALESCE(p->'attachments','[]'::jsonb);
  natt int;
BEGIN
  IF NULLIF(p->>'body_html','') IS NULL THEN RAISE EXCEPTION 'brak tresci'; END IF;
  IF st = 'ZAPLANOWANA' AND snd IS NULL THEN RAISE EXCEPTION 'brak terminu'; END IF;
  natt := jsonb_array_length(att);
  IF natt > 10 THEN RAISE EXCEPTION 'za duzo zalacznikow'; END IF;

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
    DELETE FROM public.mb_message_attachments WHERE message_id = out_id;
  END IF;

  IF natt > 0 THEN
    INSERT INTO public.mb_message_attachments (message_id, material_id, collection_id, position)
    SELECT out_id,
      NULLIF(x->>'material_id','')::uuid, NULLIF(x->>'collection_id','')::uuid, (ord - 1)
      FROM jsonb_array_elements(att) WITH ORDINALITY AS t(x, ord)
     WHERE (NULLIF(x->>'material_id','') IS NULL) <> (NULLIF(x->>'collection_id','') IS NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', out_id, 'count', cnt, 'zalaczniki', natt);
END $mss$;

-- Domknięcie wysyłki: przejście statusu jest bramką — ponowne wywołanie nic nie dubluje.
-- Każdy załącznik (materiał albo kolekcja) trafia do tych samych odbiorców.
CREATE OR REPLACE FUNCTION public.mb_admin_message_finish(p_id uuid, p_emails text[], p_actor text DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $mfn$
DECLARE
  m record;
  n int := 0;
  k int := 0;
  who text := COALESCE(NULLIF(p_actor,''), 'system');
BEGIN
  IF p_id IS NULL THEN RETURN 0; END IF;
  SELECT target INTO m FROM public.mb_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  UPDATE public.mb_messages SET status = 'WYSLANA', sent_at = now(),
    recipient_count = COALESCE(array_length(p_emails, 1), 0), updated_at = now()
   WHERE id = p_id AND status = 'WYSYLANIE';
  GET DIAGNOSTICS k = ROW_COUNT;
  IF k = 0 THEN RETURN 0; END IF;

  n := COALESCE(array_length(p_emails, 1), 0);

  IF n > 0 THEN
    INSERT INTO public.mb_message_recipients (message_id, client_email)
    SELECT p_id, lower(btrim(e)) FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> ''
    ON CONFLICT (message_id, client_email) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM public.mb_message_attachments a WHERE a.message_id = p_id) THEN
    IF m.target->>'kind' = 'grupa' AND NULLIF(m.target->>'group_id','') IS NOT NULL THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, group_id, group_mode,
        snapshot_emails, exceptions_add, exceptions_drop, note, created_by)
      SELECT a.material_id, a.collection_id, 'grupa', (m.target->>'group_id')::uuid,
        COALESCE(m.target->>'group_mode', 'OBECNI_I_PRZYSZLI'),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'snapshot_emails','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_add','[]')) x), '{}'::text[]),
        COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(m.target->'exceptions_drop','[]')) x), '{}'::text[]),
        'dołączone do wiadomości', who
        FROM public.mb_message_attachments a WHERE a.message_id = p_id;
    ELSIF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT a.material_id, a.collection_id, 'osoba', lower(btrim(e)), 'dołączone do wiadomości', who
        FROM public.mb_message_attachments a, unnest(p_emails) AS e
       WHERE a.message_id = p_id AND lower(btrim(e)) <> '';
    END IF;
  ELSIF EXISTS (SELECT 1 FROM public.mb_messages x WHERE x.id = p_id AND (x.attached_material_id IS NOT NULL OR x.attached_collection_id IS NOT NULL)) THEN
    -- Zgodność ze starą kolumną: wiadomość sprzed migracji.
    SELECT attached_material_id, attached_collection_id INTO m FROM public.mb_messages WHERE id = p_id;
    IF n > 0 THEN
      INSERT INTO public.mb_assignments (material_id, collection_id, target_kind, target_email, note, created_by)
      SELECT m.attached_material_id, m.attached_collection_id, 'osoba', lower(btrim(e)), 'dołączone do wiadomości', who
        FROM unnest(p_emails) AS e WHERE lower(btrim(e)) <> '';
    END IF;
  END IF;
  RETURN n;
END $mfn$;

-- ============ PANEL: PRZYDZIAŁ KILKU MATERIAŁÓW NARAZ ============
-- Jedno wywołanie: każdy materiał z listy trafia do tych samych odbiorców (albo do grupy wg trybu).
CREATE OR REPLACE FUNCTION public.mb_admin_assign_many(p_materials uuid[], p_target jsonb,
  p_note text DEFAULT NULL, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL, p_actor text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $amany$
DECLARE
  kind text := CASE WHEN p_target->>'kind' = 'grupa' THEN 'grupa' ELSE 'osoba' END;
  gid uuid := NULLIF(p_target->>'group_id','')::uuid;
  gmode text;
  snap text[];
  addx text[];
  dropx text[];
  tgtjson jsonb;
  em text[];
  who text := COALESCE(NULLIF(p_actor,''), 'system');
  mats uuid[];
  nmat int;
  nppl int;
  nass int;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::uuid[]) INTO mats FROM unnest(COALESCE(p_materials,'{}'::uuid[])) x WHERE x IS NOT NULL;
  nmat := COALESCE(array_length(mats, 1), 0);
  IF nmat = 0 THEN RAISE EXCEPTION 'brak materialow'; END IF;
  IF nmat > 100 THEN RAISE EXCEPTION 'za duzo materialow'; END IF;

  IF kind = 'grupa' THEN
    IF gid IS NULL THEN RAISE EXCEPTION 'brak grupy'; END IF;
    gmode := CASE WHEN p_target->>'group_mode' = 'TYLKO_OBECNI' THEN 'TYLKO_OBECNI' ELSE 'OBECNI_I_PRZYSZLI' END;
    addx := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_target->'exceptions_add','[]')) x), '{}'::text[]);
    dropx := COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(p_target->'exceptions_drop','[]')) x), '{}'::text[]);
    IF gmode = 'TYLKO_OBECNI' THEN
      SELECT COALESCE(array_agg(DISTINCT lower(btrim(m.client_email))), '{}'::text[])
        INTO snap FROM public.mb_group_members m WHERE m.group_id = gid;
    ELSE
      snap := '{}';
    END IF;
    tgtjson := jsonb_build_object('kind','grupa','group_id', gid, 'group_mode', gmode,
      'snapshot_emails', to_jsonb(snap), 'exceptions_add', to_jsonb(addx), 'exceptions_drop', to_jsonb(dropx));

    INSERT INTO public.mb_assignments (material_id, target_kind, group_id, group_mode,
      snapshot_emails, exceptions_add, exceptions_drop, note, visible_from, visible_to, created_by)
    SELECT m, 'grupa', gid, gmode, snap, addx, dropx, NULLIF(p_note,''), p_from, p_to, who
      FROM unnest(mats) AS m;
  ELSE
    em := COALESCE((SELECT array_agg(DISTINCT lower(btrim(x))) FROM jsonb_array_elements_text(COALESCE(p_target->'emails','[]')) x
       WHERE lower(btrim(x)) <> ''), '{}'::text[]);
    IF COALESCE(array_length(em, 1), 0) = 0 THEN RAISE EXCEPTION 'brak osob'; END IF;
    tgtjson := jsonb_build_object('kind','osoba','emails', to_jsonb(em));

    INSERT INTO public.mb_assignments (material_id, target_kind, target_email, note, visible_from, visible_to, created_by)
    SELECT m, 'osoba', e, NULLIF(p_note,''), p_from, p_to, who
      FROM unnest(mats) AS m, unnest(em) AS e;
  END IF;

  SELECT count(*) INTO nass FROM public.mb_assignments a
   WHERE a.created_by = who AND a.created_at > now() - interval '5 seconds' AND a.material_id = ANY(mats) AND a.revoked_at IS NULL;
  SELECT count(DISTINCT e.email) INTO nppl FROM public.mb_resolve_recipients(tgtjson) e;

  RETURN jsonb_build_object('materialy', nmat, 'osoby', COALESCE(nppl,0), 'przydzialy', COALESCE(nass,0));
END $amany$;

-- Lista wiadomości w panelu: liczba i tytuły załączników z nowej tabeli.
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
    'email_mode', s.email_mode, 'recipient_count', s.recipient_count, 'target', s.target, 'created_at', s.created_at,
    'sent_at', s.sent_at, 'withdrawn_at', s.withdrawn_at, 'group_name', s.group_name,
    'zalaczniki', (SELECT count(*) FROM public.mb_message_attachments a WHERE a.message_id = s.id),
    'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
        'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title, 'position', a.position)
        ORDER BY a.position)
       FROM public.mb_message_attachments a
       LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
       LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
      WHERE a.message_id = s.id), '[]'::jsonb),
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

-- Załączniki do podglądu formularza i ponownego otwarcia wiadomości.
CREATE OR REPLACE FUNCTION public.mb_admin_message_attachments(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $matt$
SELECT COALESCE(jsonb_agg(jsonb_build_object('material_id', a.material_id, 'collection_id', a.collection_id,
  'material_title', mm.title, 'material_kind', mm.kind, 'collection_title', cc.title, 'position', a.position)
  ORDER BY a.position), '[]'::jsonb)
FROM public.mb_message_attachments a
LEFT JOIN public.mb_materials mm ON mm.id = a.material_id
LEFT JOIN public.mb_collections cc ON cc.id = a.collection_id
WHERE a.message_id = p_id
$matt$;

-- ============ DOSTĘP: wyłącznie serwer ============
REVOKE ALL ON FUNCTION public.mb_admin_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_attachments(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mb_admin_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_attachments(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mb_lib_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_settings_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_client_messages(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_material_register(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_materials(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_save(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mb_admin_assign_many(uuid[], jsonb, text, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mb_lib_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_settings_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_open(text, boolean, uuid, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_client_messages(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_material_register(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_materials(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_save(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_message_finish(uuid, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mb_admin_assign_many(uuid[], jsonb, text, timestamptz, timestamptz, text) TO service_role;

NOTIFY pgrst, 'reload schema';
`;