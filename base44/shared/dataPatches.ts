// Jednorazowe poprawki danych zapisane w kodzie (historia zmian w repozytorium zamiast ręcznych zmian w bazie).
// Wykonuje je zadanie cykliczne cmsScheduled; każda poprawka działa raz (lista wykonanych w app_settings „data_patches”).
// Każda jest bezpieczna do powtórzenia, gdyby dwa wywołania zbiegły się w czasie.
import { runSql } from "./supabase.ts";
import { getSetting, saveSetting } from "./settings.ts";
import { clearSnap } from "./snapshot.ts";
import { ensureWaitlistCols } from "./waitlist.ts";
import { BK_BOOK_PACKAGE_SQL, BK_RESCHEDULE_SQL } from "./bookingSchema.ts";
import { TICKET_SCHEMA_SQL } from "./tickets.ts";

const PATCHES: { id: string; why: string; sql: string[] }[] = [
  {
    id: "2026-10-14-wracam-inny",
    why: "„Wracam inny”: cena regularna 97 zł, drabinka 47 zł do 22.11 i 77 zł do 6.12, „wkrótce”, premiera (przedsprzedaż) 16.11 o 6:00",
    sql: [
      `UPDATE public.products SET price = 97, price_regular = 97, price_start = NULL, promo_end_date = NULL, old_price = NULL,
         status = 'wkrótce', available_at = NULL,
         price_steps = '[{"do":"2026-11-22","cena":47},{"do":"2026-12-06","cena":77}]'::jsonb,
         release_at = '2026-11-16T06:00:00+01:00'::timestamptz, release_notify = FALSE
       WHERE slug = 'wracam-inny'`,
    ],
  },
  {
    id: "2026-10-14-cudzyslowy",
    why: "Nazwy produktów: zamykający cudzysłów „…” zamiast apostrofu lub prostego cudzysłowu",
    sql: [
      `UPDATE public.products SET name = regexp_replace(name, '„([^„”"'']*)["'']', '„\\1”', 'g') WHERE name ~ '„[^”]*["'']'`,
    ],
  },
  {
    id: "2026-10-14-karta",
    why: "Karta podarunkowa: kwoty 97 · 197 · 497 zł, „wkrótce”, premiera 1.12 o 6:00",
    sql: [
      `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_options jsonb`,
      `UPDATE public.products SET price_options = '[97,197,497]'::jsonb, price = 97, price_regular = 97, price_start = NULL,
         promo_end_date = NULL, old_price = NULL, price_steps = NULL, status = 'wkrótce', available_at = NULL,
         release_at = '2026-12-01T06:00:00+01:00'::timestamptz, release_notify = FALSE
       WHERE slug = 'karta-podarunkowa' AND product_type = 'karta'`,
    ],
  },
  {
    id: "2026-10-14-soundtrack-ukryty",
    why: "„Soundtrack powrotu” wycofany (decyzja Dawida): ukryty, nie usunięty — nie pojawia się w katalogu, następnym kroku ani powiadomieniach",
    sql: [`UPDATE public.products SET active = FALSE WHERE slug = 'soundtrack-powrotu'`],
  },
  {
    id: "2026-10-14-rezerwacje-raport",
    why: "Raport przed włączeniem rezerwacji: tryb, rodzaje (aktywne, dostęp) i godziny",
    sql: [
      `SELECT (SELECT mode FROM public.bk_settings WHERE id = 1) AS mode,
         (SELECT json_agg(json_build_object('slug', t.slug, 'active', t.active, 'access', t.access, 'dur', t.duration_min,
            'hours', (SELECT json_agg(json_build_object('d', h.weekday, 'f', to_char(h.start_local,'HH24:MI'), 't', to_char(h.end_local,'HH24:MI')) ORDER BY h.weekday, h.start_local)
                      FROM public.bk_hours h WHERE h.type_id = t.id)) ORDER BY t.sort) FROM public.bk_types t) AS types,
         (SELECT count(*) FROM public.bk_packages) AS packages,
         (SELECT count(*) FROM public.bk_bookings) AS bookings`,
    ],
  },
  {
    id: "2026-10-14-rezerwacje-powrot-start",
    why: "Rezerwacje POWRÓT: pn–pt 8:00–10:00 i 16:00–20:00 dla „Sesja POWRÓT” i „Indywidualne konsultacje”, oba rodzaje włączone, tryb „on” (decyzja Dawida 14.10; godziny zmienia w panelu)",
    sql: [
      `INSERT INTO public.bk_types (slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, monthly_limit, sort, questions, active)
         VALUES ('indywidualne-konsultacje', 'Indywidualne konsultacje', 'Spotkanie jeden na jeden: rozmowa o tym, z czym przychodzisz, i o najbliższym kroku.', 60, 15, 15, 30, 60, 'PAKIET', NULL, 5, '[]', false)
         ON CONFLICT (slug) DO NOTHING`,
      `DELETE FROM public.bk_hours WHERE type_id IN (SELECT id FROM public.bk_types WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje'))`,
      `INSERT INTO public.bk_hours (type_id, weekday, start_local, end_local)
         SELECT t.id, w, v.f, v.t FROM public.bk_types t, generate_series(1, 5) w,
           (VALUES ('08:00'::time, '10:00'::time), ('16:00'::time, '20:00'::time)) v(f, t)
         WHERE t.slug IN ('sesja-powrot', 'indywidualne-konsultacje')`,
      `UPDATE public.bk_types SET active = TRUE WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje')`,
      `UPDATE public.bk_settings SET mode = 'on', updated_at = now() WHERE id = 1`,
      `SELECT (SELECT mode FROM public.bk_settings WHERE id = 1) AS mode,
         (SELECT json_agg(json_build_object('slug', t.slug, 'active', t.active, 'n_hours', (SELECT count(*) FROM public.bk_hours h WHERE h.type_id = t.id)) ORDER BY t.sort) FROM public.bk_types t) AS types`,
    ],
  },
  {
    id: "2026-10-14-rezerwacje-odstep",
    why: "Rezerwacje z pakietu: odstęp między sesjami liczony w obie strony i pilnowany także przy przenoszeniu terminu",
    sql: [BK_BOOK_PACKAGE_SQL, BK_RESCHEDULE_SQL],
  },
  {
    id: "2026-10-14-rezerwacje-zoom",
    why: "Sesja POWRÓT i Indywidualne konsultacje: stały link Zoom z Ustawień strony (tylko gdy rodzaj nie ma własnego)",
    sql: [
      `UPDATE public.bk_types SET zoom_link = (SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly')
         WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje') AND COALESCE(zoom_link, '') = ''
           AND COALESCE((SELECT value->>'link' FROM public.app_settings WHERE key = 'zoom_staly'), '') LIKE 'https://%'`,
      `SELECT slug, (zoom_link IS NOT NULL) AS ma_zoom FROM public.bk_types WHERE slug IN ('sesja-powrot', 'indywidualne-konsultacje')`,
    ],
  },
  {
    id: "2026-10-14-bilety-schemat",
    why: "Bilety na wydarzenia: tabela event_tickets (numer, klucz QR, imię i nazwisko, status) i kolumny wydarzeń (sprzedaż, wzór)",
    sql: [TICKET_SCHEMA_SQL],
  },
];

export async function applyDataPatches(base44): Promise<string[]> {
  const done: string[] = (await getSetting(base44, "data_patches").catch(() => null)) || [];
  const todo = PATCHES.filter((p) => !done.includes(p.id));
  if (!todo.length) return [];
  await ensureWaitlistCols(base44); // kolumny premiery (release_at…) muszą istnieć
  const applied: string[] = [];
  for (const p of todo) {
    try {
      for (const q of p.sql) {
        // Zapytania SELECT w poprawce to raport stanu — wynik trafia do logu funkcji (bez danych osobowych).
        const r = await runSql(base44, q, /^\s*SELECT/i.test(q));
        if (/^\s*SELECT/i.test(q)) console.log(`[poprawka danych] ${p.id} raport:`, JSON.stringify(r).slice(0, 3000));
      }
      applied.push(p.id);
      console.log(`[poprawka danych] ${p.id}: ${p.why}`);
    } catch (e) {
      console.error(`[poprawka danych] ${p.id} nie powiodła się:`, e?.message);
    }
  }
  if (applied.length) {
    await saveSetting(base44, "data_patches", [...done, ...applied]);
    await clearSnap(base44, "products:").catch(() => {});
  }
  return applied;
}
