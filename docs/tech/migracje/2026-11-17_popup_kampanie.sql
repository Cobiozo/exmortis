-- Kampanie popup (17.11.2026) — zastosowane w Supabase (migracja "popup_kampanie").
-- 1) Jednorazowe przeniesienie dotychczasowego popupu (app_settings "popup") jako pierwszej kampanii
--    "k-przeniesiony" w app_settings "popup_kampanie" — bez zmiany treści, dat ani statusu.
-- 2) Dzienne liczniki bez danych osobowych:
CREATE TABLE IF NOT EXISTS public.popup_stats (
  kampania text NOT NULL,
  dzien date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Warsaw')::date,
  wysw int NOT NULL DEFAULT 0, klik int NOT NULL DEFAULT 0, zamk int NOT NULL DEFAULT 0,
  PRIMARY KEY (kampania, dzien));
ALTER TABLE public.popup_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.popup_stats FROM PUBLIC, anon, authenticated;
-- 3) public.popup_hit(p_kampania, p_typ) — SECURITY DEFINER, search_path = '', tylko typy wysw/klik/zamk
--    i tylko istniejące id kampanii; EXECUTE dla anon/authenticated (wywołanie z przeglądarki przez /rest/v1/rpc).
