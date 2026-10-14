import { runSql, escStr } from "./supabase.ts";
import { getSettingsFast } from "./settings.ts";
import { getSnap } from "./snapshot.ts";
import { cleanFirma, PREMIERA_DEFAULT } from "./firma.ts";
import { publicDocs } from "./legalDocs.ts";

// Publiczne dane wspólne dla siteSettings, siteContent, eventsPublic i bootstrap.
// Bez e.location, join_link i join_password — to dane prywatne.
// Link do nagrania nie wychodzi publicznie (tylko has_recording) — nagranie widzą zapisani na /dolacz.
export const PUB_COLS = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format, e.start_datetime,
  e.duration_minutes, e.description, e.for_whom, e.price, e.checkout_url,
  e.capacity, e.registration_type, e.external_url, (e.recording_url IS NOT NULL) AS has_recording, e.recording_until, e.stage,
  e.cover_image, e.cover, e.status, e.cancel_reason, e.registration_deadline, e.what_registered,
  e.open_minutes, e.zoom_faq, e.short_path, COALESCE((to_jsonb(e)->>'tickets')::boolean, false) AS tickets`;
export const REG_COUNT = `(SELECT COUNT(*) FROM public.registrations r
  WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered`;

export async function publicSettings(base44, req) {
  const hasToken = !!req.headers.get("authorization");
  const [s, me] = await Promise.all([
    getSnap(base44, "settings:firma,premiera,dokumenty", () => getSettingsFast(base44, ["firma", "premiera", "dokumenty"])) as Promise<Record<string, any>>,
    hasToken ? base44.auth.me().catch(() => null) : null,
  ]);
  const { dostep = [], ...p } = { ...PREMIERA_DEFAULT, ...(s.premiera || {}) };
  const email = String(me?.email || "").toLowerCase();
  const ja_dostep = !!email && dostep.some((x) => x.email === email && Date.parse(x.do) > Date.now());
  return { firma: cleanFirma(s.firma), dokumenty: publicDocs(s.dokumenty), premiera: p, ja_dostep, now: new Date().toISOString() };
}

export const publicContent = (base44) =>
  getSnap(base44, "content", () => runSql(base44, `SELECT page_key, block_key, value FROM public.page_content`, true));

export const publicEvent = (base44, slug: string) =>
  getSnap(base44, `events:get:${slug}`, async () => {
    const rows = await runSql(base44, `SELECT ${PUB_COLS}, ${REG_COUNT} FROM public.events e WHERE e.slug = ${escStr(slug)}`, true);
    return rows?.[0] || null;
  });