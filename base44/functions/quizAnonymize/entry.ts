import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

// Jednorazowo (5.11.2026, decyzja właściciela: Obok → Biblioteka): reguła grup „wszystkie_konta”
// w bazie i grupa „Wszystkie konta” do przydzielania materiałów każdej osobie z kontem.
// Idempotentne, bez parametrów, zwraca tylko liczby. Po użyciu wyłączane.
const GR = `DO $gr$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.mb_groups'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%aktywny_pakiet%' AND pg_get_constraintdef(oid) NOT LIKE '%wszystkie_konta%' LOOP
    EXECUTE format('ALTER TABLE public.mb_groups DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.mb_groups'::regclass AND pg_get_constraintdef(oid) LIKE '%wszystkie_konta%') THEN
    ALTER TABLE public.mb_groups ADD CONSTRAINT mb_groups_rule_kind CHECK ((kind = 'RECZNA' AND rule IS NULL)
      OR (kind = 'AUTOMATYCZNA' AND rule IS NOT NULL AND rule->>'typ' IN ('produkt','aktywny_pakiet','wszystkie_konta')));
  END IF;
END $gr$;`;
const FN = `CREATE OR REPLACE FUNCTION public.mb_auto_group_emails(p_rule jsonb)
RETURNS TABLE (email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $ae$
BEGIN
  IF p_rule->>'typ' = 'produkt' AND COALESCE(p_rule->>'id','') <> '' THEN
    RETURN QUERY
      SELECT DISTINCT lower(btrim(o.buyer_email))
        FROM public.orders o, jsonb_array_elements(o.items) e
       WHERE o.status = 'COMPLETED' AND e->>'product_id' = p_rule->>'id' AND o.buyer_email IS NOT NULL;
  ELSIF p_rule->>'typ' = 'aktywny_pakiet' THEN
    -- Opcjonalny type_id: bez niego reguła obejmuje KAŻDY aktywny pakiet, z nim tylko ten typ spotkania.
    RETURN QUERY
      SELECT DISTINCT lower(btrim(p.email_display))
        FROM public.bk_packages p
       WHERE p.payment_status = 'oplacony' AND p.valid_until > now()
         AND p.sessions_used < p.sessions_total AND p.email_display IS NOT NULL
         AND (COALESCE(p_rule->>'type_id','') = '' OR p.type_id::text = p_rule->>'type_id');
  ELSIF p_rule->>'typ' = 'wszystkie_konta' THEN
    -- Każda osoba z kontem (logowanie Supabase), bez kont usuniętych i zablokowanych.
    RETURN QUERY
      SELECT DISTINCT lower(btrim(u.email::text))
        FROM auth.users u
       WHERE u.email IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until < now());
  END IF;
END $ae$;`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await runSql(base44, GR);
    await runSql(base44, FN);
    await runSql(base44, `INSERT INTO public.mb_groups (name, color, description, kind, rule, accepted_at, created_by)
      SELECT 'Wszystkie konta', '#C9A24A', 'Każda osoba z kontem exmortis (liczone automatycznie przy każdym otwarciu).',
             'AUTOMATYCZNA', '{"typ":"wszystkie_konta"}'::jsonb, now(), 'system'
      WHERE NOT EXISTS (SELECT 1 FROM public.mb_groups WHERE rule->>'typ' = 'wszystkie_konta')`);
    const g = await runSql(base44, `SELECT id::text AS id FROM public.mb_groups WHERE rule->>'typ' = 'wszystkie_konta' LIMIT 1`, true);
    const n = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.mb_auto_group_emails('{"typ":"wszystkie_konta"}'::jsonb)`, true);
    const st = await runSql(base44, `SELECT library_mode, messages_mode FROM public.mb_settings WHERE id = 1`, true);
    return Response.json({ ok: true, group: !!g?.[0]?.id, members: n?.[0]?.n ?? null, library_mode: st?.[0]?.library_mode ?? null, messages_mode: st?.[0]?.messages_mode ?? null });
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
});
