import { runSql, escStr } from "./supabase.ts";
import { getSettingsFast } from "./settings.ts";
import { getSnap } from "./snapshot.ts";
import { cleanFirma, PREMIERA_DEFAULT } from "./firma.ts";
import { cleanAplikacja } from "./appOffline.ts";
import { cleanPomiar } from "./tracking.ts";
import { publicDocs } from "./legalDocs.ts";
import { publicPopup, publicCampaigns, legacyFromCampaigns, forViewer } from "./popup.ts";

// Publiczne dane wspólne dla siteSettings, siteContent, eventsPublic i bootstrap.
// Bez e.location, join_link i join_password — to dane prywatne.
// Link do nagrania nie wychodzi publicznie (tylko has_recording) — nagranie widzą zapisani na /dolacz.
export const PUB_COLS = `e.id, e.title, e.slug, e.subtitle, e.event_type, e.format, e.start_datetime,
  e.duration_minutes, e.description, e.for_whom, e.price, e.checkout_url,
  e.capacity, e.registration_type, e.external_url, (e.recording_url IS NOT NULL) AS has_recording, e.recording_until, e.stage,
  e.cover_image, e.cover, e.status, e.cancel_reason, e.registration_deadline, e.what_registered,
  e.open_minutes, e.zoom_faq, e.short_path, COALESCE((to_jsonb(e)->>'tickets')::boolean, false) AS tickets,
  COALESCE((to_jsonb(e)->>'kto_prowadzi')::boolean, true) AS kto_prowadzi`;
export const REG_COUNT = `(SELECT COUNT(*) FROM public.registrations r
  WHERE r.event_id = e.id AND r.status IN ('Zapisany','Obecny'))::int AS registered`;

export async function publicSettings(base44, req) {
  const hasToken = !!req.headers.get("authorization");
  const [s, me] = await Promise.all([
    getSnap(base44, "settings:firma,premiera,dokumenty,pomiar,aplikacja,popup", () => getSettingsFast(base44, ["firma", "premiera", "dokumenty", "pomiar", "aplikacja", "popup"])) as Promise<Record<string, any>>,
    hasToken ? base44.auth.me().catch(() => null) : null,
  ]);
  // Kampanie popup (17.11.2026): lista rozwiązana z bazy (produkt, spotkanie, ważność kodu), pamięć 60 s.
  // Gdy kampanii jeszcze nie ma (przed migracją), działa dawny pojedynczy popup.
  const camp = await getSnap(base44, "popups", async () => {
    const [row] = await runSql(base44, `SELECT value FROM public.app_settings WHERE key = 'popup_kampanie'`, true);
    return Array.isArray(row?.value?.items) ? await publicCampaigns(base44, row.value.items) : null;
  }).catch(() => null) as any[] | null;
  const { dostep = [], ...p } = { ...PREMIERA_DEFAULT, ...(s.premiera || {}) };
  const email = String(me?.email || "").toLowerCase();
  const ja_dostep = !!email && dostep.some((x) => x.email === email && Date.parse(x.do) > Date.now());
  // Pomiar (Meta Pixel / GA4) — wartości publiczne, idą do gościa tym samym wywołaniem co reszta ustawień.
  return { firma: cleanFirma(s.firma), dokumenty: publicDocs(s.dokumenty), pomiar: cleanPomiar(s.pomiar), aplikacja: cleanAplikacja(s.aplikacja), popup: camp ? legacyFromCampaigns(camp) : publicPopup(s.popup), popups: camp ? await forViewer(base44, camp, me) : null, premiera: p, ja_dostep, now: new Date().toISOString() };
}

export const publicContent = (base44) =>
  getSnap(base44, "content", () => runSql(base44, `SELECT page_key, block_key, value FROM public.page_content`, true));

export const publicEvent = (base44, slug: string) =>
  getSnap(base44, `events:get:${slug}`, async () => {
    const rows = await runSql(base44, `SELECT ${PUB_COLS}, ${REG_COUNT} FROM public.events e WHERE e.slug = ${escStr(slug)}`, true);
    return rows?.[0] || null;
  });