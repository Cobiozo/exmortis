import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, requireAdmin } from "../../shared/supabase.ts";

const STATS_SQL = `SELECT
  (SELECT COUNT(*)::int FROM public.events WHERE status = 'Opublikowane' AND start_datetime > now()) AS upcoming_events,
  (SELECT COUNT(*)::int FROM public.registrations r JOIN public.events e ON e.id = r.event_id
     WHERE e.start_datetime > now() AND COALESCE(r.status, '') NOT ILIKE 'wycof%') AS upcoming_registrations,
  (SELECT COUNT(*)::int FROM public.events WHERE status = 'Szkic') AS draft_events,
  (SELECT row_to_json(s) FROM (SELECT intro_uri, outro_uri, background_uri FROM public.silence_settings LIMIT 1) s) AS silence,
  (SELECT COUNT(*)::int FROM public.products WHERE active = TRUE AND COALESCE(status, 'dostępny') NOT IN ('wkrótce', 'ukryty')) AS products_available,
  (SELECT COUNT(*)::int FROM public.products WHERE active = TRUE AND status = 'wkrótce') AS products_soon,
  (SELECT COUNT(*)::int FROM public.products WHERE active = FALSE OR status = 'ukryty') AS products_hidden,
  (SELECT COUNT(*)::int FROM public.registrations WHERE created_at > now() - interval '30 days') AS reg_30,
  (SELECT COUNT(*)::int FROM public.orders WHERE COALESCE(total, 0) = 0 AND created_date > now() - interval '30 days') AS downloads_30,
  (SELECT COUNT(*)::int FROM public.silence_sessions WHERE created_at > now() - interval '30 days') AS silence_30`;

const CONTACTS_SQL = `SELECT * FROM (
  SELECT 'Kontakt' AS source, name, email, NULL::text AS phone, created_date::timestamptz AS at FROM public.contact_messages
  UNION ALL SELECT 'Podcast', full_name, email, phone, created_date::timestamptz FROM public.podcast_applications
  UNION ALL SELECT 'Powrót', full_name, email, phone, created_date::timestamptz FROM public.powrot_applications
  UNION ALL SELECT 'Zamówienie', buyer_name, buyer_email, buyer_phone, created_date::timestamptz FROM public.orders
  UNION ALL SELECT 'Spotkanie', first_name, email, NULL, created_at::timestamptz FROM public.registrations
  UNION ALL SELECT 'Lista oczekujących', first_name, email, NULL, created_at::timestamptz FROM public.waitlist
  UNION ALL SELECT 'Newsletter', name, email, NULL, created_date::timestamptz FROM public.subscribers
) c ORDER BY at DESC NULLS LAST LIMIT 2000`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action === "contacts") {
      return Response.json({ contacts: await runSql(base44, CONTACTS_SQL, true) });
    }
    const rows = await runSql(base44, STATS_SQL, true);
    return Response.json({ stats: rows[0] || {} });
  } catch (error) {
    const forbidden = error.message === "FORBIDDEN";
    return Response.json({ error: forbidden ? "Brak dostępu" : error.message }, { status: forbidden ? 403 : 500 });
  }
}