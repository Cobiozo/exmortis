-- Odwzorowanie produkcji wg inspekcji 5.11.2026 (struktura, bez prawdziwych danych).
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.orders (
  id text PRIMARY KEY, payu_order_id text, buyer_name text, buyer_email text, note text, items jsonb NOT NULL,
  total numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'NEW', created_date timestamptz DEFAULT now(),
  updated_date timestamptz DEFAULT now(), buyer_phone text, phone_consent_date timestamptz, newsletter_consent_date timestamptz,
  digital_consent_text text, digital_consent_date timestamptz, discount_code text, refunded_total numeric DEFAULT 0, reminded_at timestamptz);
CREATE INDEX orders_payu_idx ON public.orders (payu_order_id);
CREATE INDEX orders_email_idx ON public.orders (lower(buyer_email));
CREATE INDEX orders_status_created_idx ON public.orders (status, created_date DESC);
CREATE INDEX orders_updated_idx ON public.orders (updated_date);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.products (id uuid PRIMARY KEY, name text, product_type text, price numeric DEFAULT 0, active boolean DEFAULT true, status text, capacity int);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.events (id text PRIMARY KEY, title text, tickets boolean DEFAULT false, ticket_template jsonb);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_date timestamptz DEFAULT now());
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.event_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, token text NOT NULL UNIQUE,
  event_id text NOT NULL, order_id text, line_no int NOT NULL DEFAULT 0, holder_name text NOT NULL, buyer_email text,
  price numeric(10,2) NOT NULL DEFAULT 0, source text NOT NULL DEFAULT 'zakup',
  status text NOT NULL DEFAULT 'wazny' CHECK (status IN ('wazny','wykorzystany','anulowany')), checked_at timestamptz, checked_by text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (order_id, line_no));
ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.order_refunds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id text NOT NULL, amount numeric(10,2) NOT NULL,
  reason text, status text NOT NULL DEFAULT 'nowy', payu_refund_id text, ext_refund_id text, revoke_access boolean NOT NULL DEFAULT false,
  cancel_tickets boolean NOT NULL DEFAULT false, void_cards boolean NOT NULL DEFAULT false, effects_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, created_by text);
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
DO $m$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['exm_access','exm_consent','exm_discountcode','exm_mailqueue','exm_user'] LOOP
    EXECUTE format('CREATE TABLE public.%I (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT ''{}''::jsonb, created_date timestamptz NOT NULL DEFAULT now(), updated_date timestamptz NOT NULL DEFAULT now(), created_by_id text)', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP; END $m$;
CREATE SCHEMA backup; CREATE TABLE backup.a (x int); CREATE TABLE backup.b (x int); CREATE TABLE backup.c (x int);
REVOKE ALL ON SCHEMA backup FROM PUBLIC;

-- Dane syntetyczne (bez danych osób).
INSERT INTO public.products (id, name, product_type, price) VALUES
  ('11111111-1111-1111-1111-111111111111', 'PDF', 'pdf', 0),
  ('22222222-2222-2222-2222-222222222222', 'Karta', 'karta', 0),
  ('33333333-3333-3333-3333-333333333333', 'Kurs', 'kurs', 2),
  ('44444444-4444-4444-4444-444444444444', 'Warsztat', 'usluga', 50);
UPDATE public.products SET capacity = 1 WHERE product_type = 'usluga';
-- A: COMPLETED, PDF, dostęp + mail → potwierdzone; B: COMPLETED, karta + mail → potwierdzone; C: COMPLETED kurs bez dowodów → ręczna weryfikacja.
INSERT INTO public.orders (id, payu_order_id, items, total, status) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'FREE-aaaaaaaa-0000-0000-0000-000000000001', '[{"product_id":"11111111-1111-1111-1111-111111111111","quantity":1}]', 0, 'COMPLETED'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'FREE-bbbbbbbb-0000-0000-0000-000000000002', '[{"product_id":"22222222-2222-2222-2222-222222222222","quantity":1}]', 0, 'COMPLETED'),
  ('cccccccc-0000-0000-0000-000000000003', 'FREE-cccccccc-0000-0000-0000-000000000003', '[{"product_id":"33333333-3333-3333-3333-333333333333","quantity":1}]', 0, 'COMPLETED');
INSERT INTO public.orders (id, payu_order_id, items, total, status)
  SELECT 'free-' || g, '', '[]', 0, 'FREE' FROM generate_series(1, 12) g;
INSERT INTO public.exm_access (id, data) VALUES ('acc1', '{"product_id":"11111111-1111-1111-1111-111111111111","history":[{"order_id":"aaaaaaaa-0000-0000-0000-000000000001"}]}');
INSERT INTO public.exm_discountcode (id, data) VALUES ('dc1', '{"opis":"Karta podarunkowa — zamówienie BBBBBBBB"}');
INSERT INTO public.exm_mailqueue (id, data) VALUES
  ('m1', '{"kind":"zamowienie","ref":"aaaaaaaa-0000-0000-0000-000000000001","status":"wyslany"}'),
  ('m2', '{"kind":"zamowienie","ref":"bbbbbbbb-0000-0000-0000-000000000002","status":"wyslany"}');
