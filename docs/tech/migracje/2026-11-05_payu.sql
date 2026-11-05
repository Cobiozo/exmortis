-- Exmortis — PayU: migracja 2026-11-05, WERSJA 3 (po inspekcji produkcji 5.11.2026 ok. 20:25; bez DDL w trakcie zakupu)
-- Projekt Supabase: fqhvxhnbeyvwubpnuzxe (Exmortis). Uruchamiać PRZED wdrożeniem funkcji PayU.
--
-- Stan z inspekcji: orders 14 wierszy (2 COMPLETED z 13.10 — bez płatności, 12 FREE), RLS włączone bez polityk,
-- brak ograniczeń CHECK, wyzwalaczy i zależnych widoków; brak payu_events i discount_reservations;
-- brak kolumn invoice*, payu_status, redirect_uri, fulfilled_at, fulfill_*; order_refunds bez correction_*.
-- Od tej wersji kod funkcji nie zakłada żadnych struktur w trakcie zakupu — wszystkie są tutaj (kroki 2–6).
--
-- Zasady: jedna transakcja, idempotentna (można powtórzyć), lock_timeout 5 s. Nie usuwa wierszy ani kolumn.
-- Zmiana danych tylko w krokach 7–8: fulfilled_at WYŁĄCZNIE dla zamówień COMPLETED z kompletem dowodów realizacji
-- (dostępy, bilety, karty, wysłany mail); pozostałe COMPLETED → oznaczenie do ręcznej weryfikacji, bez automatycznych ponowień.
-- PRZED uruchomieniem: niezależny backup (pg_dump poza Supabase) — kopia w kroku 0 jest tylko pomocnicza.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 0. Kopia pomocnicza w tej samej bazie (schemat backup bez dostępu anon/authenticated).
CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup.orders_przed_payu_20261105 AS TABLE public.orders;
REVOKE ALL ON backup.orders_przed_payu_20261105 FROM PUBLIC, anon, authenticated;

-- 1. Bezpiecznik: ewentualne CHECK na status musi dopuszczać CREATING i FAILED (dziś CHECK nie ma).
DO $c$ DECLARE r record; BEGIN
  FOR r IN SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint
            WHERE conrelid = 'public.orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    IF r.d NOT ILIKE '%CREATING%' OR r.d NOT ILIKE '%FAILED%' THEN
      RAISE EXCEPTION 'Ograniczenie % na orders.status nie dopuszcza CREATING/FAILED: %', r.conname, r.d;
    END IF;
  END LOOP;
END $c$;

-- 2. orders — płatność i realizacja (rozdzielone).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payu_status        text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS redirect_uri       text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfilled_at       timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_lock_at    timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_tries      integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_error      text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_alerted_at timestamptz;   -- jednorazowy alert po limicie ponowień
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_review     text;          -- ręczna weryfikacja / opis decyzji
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_test            boolean NOT NULL DEFAULT false; -- zamówienia testowe: bez maili, faktur i dostępów

-- 3. orders — kolumny zakładane dotąd w trakcie zakupu (ensureInvoiceColumn/ensureDiscountColumn/ensureInvoiceColumns/refunds/unpaidReminder).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice        jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_id     text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_url    text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_at     timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_error  text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code  text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_total numeric(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reminded_at    timestamptz;

-- 3b. Struktury zakładane dotąd w locie przez funkcje zakupu (tickets.ts, refunds.ts, mirror.ts) — już istnieją
--     w produkcji; tu idempotentnie, żeby nowa baza (np. odtworzona z kopii) była kompletna bez DDL w kodzie.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tickets boolean DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_template jsonb;
CREATE TABLE IF NOT EXISTS public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  event_id text NOT NULL,
  order_id text,
  line_no int NOT NULL DEFAULT 0,
  holder_name text NOT NULL,
  buyer_email text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'zakup',
  status text NOT NULL DEFAULT 'wazny' CHECK (status IN ('wazny','wykorzystany','anulowany')),
  checked_at timestamptz,
  checked_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, line_no)
);
CREATE INDEX IF NOT EXISTS event_tickets_event_idx ON public.event_tickets (event_id);
CREATE INDEX IF NOT EXISTS event_tickets_email_idx ON public.event_tickets (lower(buyer_email));
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_tickets FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  amount numeric(10,2) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'nowy',
  payu_refund_id text,
  ext_refund_id text,
  revoke_access boolean NOT NULL DEFAULT false,
  cancel_tickets boolean NOT NULL DEFAULT false,
  void_cards boolean NOT NULL DEFAULT false,
  effects_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  created_by text
);
CREATE UNIQUE INDEX IF NOT EXISTS order_refunds_ext_idx ON public.order_refunds (ext_refund_id);
CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON public.order_refunds (order_id);
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_refunds FROM PUBLIC, anon, authenticated;

DO $m$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['exm_access', 'exm_consent'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT ''{}''::jsonb,
      created_date timestamptz NOT NULL DEFAULT now(), updated_date timestamptz NOT NULL DEFAULT now(), created_by_id text)', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin (data jsonb_path_ops)', t || '_data_gin', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (updated_date)', t || '_updated_idx', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $m$;

-- 4. order_refunds — kolumny korekt faktur (tabela istnieje).
ALTER TABLE public.order_refunds ADD COLUMN IF NOT EXISTS correction_id     text;
ALTER TABLE public.order_refunds ADD COLUMN IF NOT EXISTS correction_number text;
ALTER TABLE public.order_refunds ADD COLUMN IF NOT EXISTS correction_url    text;
ALTER TABLE public.order_refunds ADD COLUMN IF NOT EXISTS correction_error  text;

-- 5. Rezerwacje kodów z limitem użyć (dotąd zakładane przy pierwszym użyciu kodu) — treść 1:1 z discounts.ts.
CREATE TABLE IF NOT EXISTS public.discount_reservations (
  order_id text PRIMARY KEY, code text NOT NULL, email text, used boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS discount_reservations_code_idx ON public.discount_reservations (code);
ALTER TABLE public.discount_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_reservations FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.exm_reserve_code(p_code text, p_order text, p_email text, p_free int) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $f$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('kod:' || p_code));
  DELETE FROM public.discount_reservations WHERE NOT used AND created_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.discount_reservations WHERE code = p_code AND NOT used AND created_at > now() - interval '30 minutes'
        AND order_id <> p_order AND lower(COALESCE(email, '')) <> lower(COALESCE(p_email, ''))) >= p_free THEN
    RETURN false;
  END IF;
  INSERT INTO public.discount_reservations (order_id, code, email) VALUES (p_order, p_code, lower(p_email)) ON CONFLICT (order_id) DO NOTHING;
  RETURN true;
END $f$;
REVOKE EXECUTE ON FUNCTION public.exm_reserve_code(text, text, text, int) FROM PUBLIC, anon, authenticated;

-- 6. Kolejka powiadomień PayU — dane kupującego z powiadomienia, dostęp wyłącznie dla backendu.
CREATE TABLE IF NOT EXISTS public.payu_events (
  id              text PRIMARY KEY,                 -- numer zamówienia PayU + ":" + status
  payu_order_id   text NOT NULL DEFAULT '',
  ext_order_id    text NOT NULL DEFAULT '',
  payu_status     text NOT NULL DEFAULT '',
  payload         jsonb,
  received_at     timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz,
  processed_at    timestamptz,
  tries           integer NOT NULL DEFAULT 0,
  last_error      text,
  result          text,
  alerted_at      timestamptz                       -- jednorazowy alert, gdy zdarzenie długo nie może się przetworzyć
);
CREATE INDEX IF NOT EXISTS payu_events_due_idx   ON public.payu_events (next_attempt_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS payu_events_order_idx ON public.payu_events (payu_order_id);
CREATE INDEX IF NOT EXISTS payu_events_ext_idx   ON public.payu_events (ext_order_id);
ALTER TABLE public.payu_events ENABLE ROW LEVEL SECURITY;   -- bez polityk: anon/authenticated nie widzą nic
REVOKE ALL ON public.payu_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payu_events TO service_role;

-- 7. Historyczne COMPLETED z kompletem dowodów realizacji → fulfilled_at (na dziś: 2 zamówienia z 13.10).
WITH o AS (SELECT id, items FROM public.orders WHERE status = 'COMPLETED' AND fulfilled_at IS NULL),
it AS (SELECT o.id AS oid, i->>'product_id' AS pid, COALESCE((i->>'quantity')::int, 1) AS q, i->>'kind' AS kind
       FROM o, jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) i),
typ AS (SELECT it.*, p.product_type FROM it LEFT JOIN public.products p ON p.id::text = it.pid),
ev AS (
  SELECT o.id,
    (SELECT count(*) FROM typ WHERE typ.oid = o.id AND typ.product_type IS NULL AND COALESCE(typ.kind, '') <> 'bilet') AS nieznane,
    (SELECT count(*) FROM typ WHERE typ.oid = o.id AND typ.product_type IN ('pdf','audio','wideo','kurs','pakiet')) AS cyfrowe,
    (SELECT count(*) FROM public.exm_access a WHERE a.data->'history' @> jsonb_build_array(jsonb_build_object('order_id', o.id))) AS dostepy,
    (SELECT COALESCE(sum(q), 0) FROM typ WHERE typ.oid = o.id AND typ.kind = 'bilet') AS bilety_ocz,
    (SELECT count(*) FROM public.event_tickets t WHERE t.order_id = o.id) AS bilety,
    (SELECT COALESCE(sum(q), 0) FROM typ WHERE typ.oid = o.id AND typ.product_type = 'karta') AS karty_ocz,
    (SELECT count(*) FROM public.exm_discountcode d WHERE d.data->>'opis' ILIKE '%zamówienie ' || upper(left(o.id, 8)) || '%') AS karty,
    EXISTS (SELECT 1 FROM public.exm_mailqueue m WHERE m.data->>'kind' = 'zamowienie' AND m.data->>'ref' = o.id AND m.data->>'status' = 'wyslany') AS mail
  FROM o)
UPDATE public.orders x
   SET fulfilled_at = COALESCE(x.updated_date, x.created_date, now()),
       fulfill_review = 'migracja 2026-11-05: realizacja potwierdzona (dostępy, bilety, karty, mail)'
  FROM ev
 WHERE x.id = ev.id AND ev.nieznane = 0 AND ev.mail
   AND (ev.cyfrowe = 0 OR ev.dostepy >= 1)
   AND ev.bilety >= ev.bilety_ocz AND ev.karty >= ev.karty_ocz;

-- 8. Pozostałe COMPLETED bez kompletu dowodów → ręczna weryfikacja, wyłączone z automatycznych ponowień.
UPDATE public.orders
   SET fulfill_review = 'DO RĘCZNEJ WERYFIKACJI: brak kompletu dowodów realizacji (migracja 2026-11-05)',
       fulfill_tries = GREATEST(fulfill_tries, 9999)
 WHERE status = 'COMPLETED' AND fulfilled_at IS NULL AND fulfill_review IS NULL;

-- 9. Indeks dla ponowień realizacji (pozostałe indeksy orders już istnieją).
CREATE INDEX IF NOT EXISTS orders_unfulfilled_idx ON public.orders (updated_date) WHERE status = 'COMPLETED' AND fulfilled_at IS NULL;

COMMIT;

-- 10. Kontrola po migracji (tylko odczyt):
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payu_events'::regclass;                          -- true
-- SELECT has_table_privilege('anon','public.payu_events','SELECT'), has_table_privilege('authenticated','public.payu_events','SELECT'); -- false, false
-- SELECT has_function_privilege('anon','public.exm_reserve_code(text,text,text,int)','EXECUTE');          -- false
-- SELECT status, count(*), count(fulfilled_at), count(*) FILTER (WHERE fulfill_review LIKE 'DO RĘCZNEJ%') FROM public.orders GROUP BY 1;
--    oczekiwane dziś: COMPLETED 2 / 2 / 0; FREE 12 / 0 / 0
-- SELECT (SELECT count(*) FROM public.orders) = (SELECT count(*) FROM backup.orders_przed_payu_20261105);     -- true
