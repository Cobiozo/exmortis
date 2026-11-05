// Anonimowy licznik ukończeń testu „Która śmierć jest Twoja?” (5.11.2026).
// Tylko sumy: dzień (czas polski) × wynik → liczba. Żadnych wierszy na osobę, IP, odpowiedzi ani etapu.
// test_done — publiczna (anon), dolicza +1; limit 2000 na dzień i wynik chroni przed zalewem.
// test_stats — tylko administrator (rola admin w exm_user dla e-maila z tokenu sesji).
export const TEST_COUNT_SQL = `
CREATE TABLE IF NOT EXISTS public.test_counts (
  day date NOT NULL,
  result text NOT NULL CHECK (result IN ('mentalna','duchowa','zyciowa','wiele','zadna')),
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, result)
);
ALTER TABLE public.test_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_counts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.test_done(p_result text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_day date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
BEGIN
  IF p_result IS NULL OR p_result NOT IN ('mentalna','duchowa','zyciowa','wiele','zadna') THEN RETURN; END IF;
  INSERT INTO public.test_counts AS t (day, result, n) VALUES (v_day, p_result, 1)
  ON CONFLICT (day, result) DO UPDATE SET n = t.n + 1 WHERE t.n < 2000;
END $fn$;

CREATE OR REPLACE FUNCTION public.test_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_email text := lower(coalesce(auth.jwt()->>'email', ''));
BEGIN
  IF v_email = '' OR NOT EXISTS (
    SELECT 1 FROM public.exm_user u WHERE lower(u.data->>'email') = v_email AND u.data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('day', day, 'result', result, 'n', n) ORDER BY day DESC, result)
    FROM public.test_counts WHERE day >= (now() AT TIME ZONE 'Europe/Warsaw')::date - 400
  ), '[]'::jsonb);
END $fn$;

REVOKE ALL ON FUNCTION public.test_done(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_done(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_stats() TO authenticated;
NOTIFY pgrst, 'reload schema';
`;
