-- Exmortis — PayU: kolumny zamówień, kolejka powiadomień, uprawnienia (5.11.2026)
-- Projekt Supabase: fqhvxhnbeyvwubpnuzxe (Exmortis). Uruchamiać PRZED wdrożeniem funkcji
-- payuCreateOrder, payuNotification, adminSettings, cmsScheduled, adminOrders.
--
-- Migracja jest idempotentna (można ją uruchomić wielokrotnie) i działa w jednej transakcji.
-- Nie usuwa zamówień ani kolumn. Jedyna zmiana danych: fulfilled_at dla zamówień już opłaconych
-- (zrealizowanych starym kodem w jednym kroku), żeby ponawianie realizacji nie objęło ich drugi raz.
-- Kod funkcji nie wykonuje już żadnego DDL dla tych struktur (orders.ts: ensureOrdersTable jest pusta).

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 0. Kopia zamówień w schemacie backup (niedostępnym dla anon/authenticated) — tylko przy pierwszym uruchomieniu.
CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS backup.orders_przed_payu_20261105 AS TABLE public.orders;
REVOKE ALL ON backup.orders_przed_payu_20261105 FROM PUBLIC, anon, authenticated;

-- 1. Ograniczenia statusu: nowe statusy CREATING i FAILED muszą być dozwolone. Jeśli istnieje ograniczenie
--    CHECK na status bez tych wartości — przerwij (do ręcznej decyzji), zamiast zgadywać listę.
DO $c$ DECLARE r record; BEGIN
  FOR r IN SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint
            WHERE conrelid = 'public.orders'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    IF r.d NOT ILIKE '%CREATING%' OR r.d NOT ILIKE '%FAILED%' THEN
      RAISE EXCEPTION 'Ograniczenie % na orders.status nie dopuszcza CREATING/FAILED: %', r.conname, r.d;
    END IF;
  END LOOP;
END $c$;

-- 2. Kolumny zamówień (płatność i realizacja rozdzielone).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payu_status     text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS redirect_uri    text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfilled_at    timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_lock_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_tries   integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfill_error   text;

-- 3. Zamówienia opłacone przed wdrożeniem: realizacja odbyła się razem z przejęciem COMPLETED (stary kod).
UPDATE public.orders
   SET fulfilled_at = COALESCE(updated_date::timestamptz, created_date::timestamptz, now())
 WHERE status = 'COMPLETED' AND fulfilled_at IS NULL;

-- 4. Indeksy (dotąd zakładane w locie przy pierwszym zamówieniu).
CREATE INDEX IF NOT EXISTS orders_payu_idx           ON public.orders (payu_order_id);
CREATE INDEX IF NOT EXISTS orders_email_idx          ON public.orders (lower(buyer_email));
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders (status, created_date DESC);
CREATE INDEX IF NOT EXISTS orders_updated_idx        ON public.orders (updated_date);
CREATE INDEX IF NOT EXISTS orders_unfulfilled_idx    ON public.orders (updated_date) WHERE status = 'COMPLETED' AND fulfilled_at IS NULL;

-- 5. Kolejka powiadomień PayU. Zawiera dane kupującego z powiadomienia — dostęp wyłącznie dla backendu.
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
  result          text
);
ALTER TABLE public.payu_events ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE public.payu_events ADD COLUMN IF NOT EXISTS result text;
CREATE INDEX IF NOT EXISTS payu_events_due_idx   ON public.payu_events (next_attempt_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS payu_events_order_idx ON public.payu_events (payu_order_id);
CREATE INDEX IF NOT EXISTS payu_events_ext_idx   ON public.payu_events (ext_order_id);

ALTER TABLE public.payu_events ENABLE ROW LEVEL SECURITY;   -- bez polityk: anon/authenticated nie widzą nic
REVOKE ALL ON public.payu_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payu_events TO service_role;

COMMIT;

-- 6. Kontrola po migracji (tylko odczyt):
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.payu_events'::regclass;                     -- true
-- SELECT has_table_privilege('anon', 'public.payu_events', 'SELECT'),
--        has_table_privilege('authenticated', 'public.payu_events', 'SELECT');                        -- false, false
-- SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders'
--    AND column_name IN ('payu_status','redirect_uri','fulfilled_at','fulfill_lock_at','fulfill_tries','fulfill_error'); -- 6
-- SELECT count(*) FROM public.orders WHERE status = 'COMPLETED' AND fulfilled_at IS NULL;              -- 0
-- SELECT (SELECT count(*) FROM public.orders) = (SELECT count(*) FROM backup.orders_przed_payu_20261105); -- true
