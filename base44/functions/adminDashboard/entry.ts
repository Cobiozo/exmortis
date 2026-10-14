import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, requireAdmin } from "../../shared/supabase.ts";
import { getSetting } from "../../shared/settings.ts";
import { mailReady } from "../../shared/smtp.ts";
import { cleanFaktury, fakturyToken, FAKTURY_DEFAULT, DOKUMENT_OSOBA } from "../../shared/invoices.ts";

const STATS_SQL = `SELECT
  (SELECT COUNT(*)::int FROM public.events WHERE status = 'Opublikowane' AND start_datetime > now()) AS upcoming_events,
  (SELECT COUNT(*)::int FROM public.registrations r JOIN public.events e ON e.id = r.event_id
     WHERE e.start_datetime > now() AND COALESCE(r.status, '') NOT ILIKE 'wycof%') AS upcoming_registrations,
  (SELECT COUNT(*)::int FROM public.events WHERE status = 'Szkic') AS draft_events,
  (SELECT COALESCE(json_agg(json_build_object('title', title, 'start', start_datetime) ORDER BY start_datetime), '[]'::json)
     FROM public.events WHERE status = 'Opublikowane' AND format = 'Online' AND COALESCE(join_link, '') = ''
       AND start_datetime > now() - interval '3 hours' AND start_datetime < now() + interval '48 hours') AS zoom_missing,
  (SELECT row_to_json(s) FROM (SELECT intro_uri, outro_uri, background_uri FROM public.silence_settings LIMIT 1) s) AS silence,
  (SELECT COUNT(*)::int FROM public.products WHERE active = TRUE AND COALESCE(status, 'dostępny') NOT IN ('wkrótce', 'ukryty')) AS products_available,
  (SELECT COUNT(*)::int FROM public.products WHERE active = TRUE AND status = 'wkrótce') AS products_soon,
  (SELECT COUNT(*)::int FROM public.products WHERE active = FALSE OR status = 'ukryty') AS products_hidden,
  (SELECT COUNT(*)::int FROM public.registrations WHERE created_at > now() - interval '30 days') AS reg_30,
  (SELECT COUNT(*)::int FROM public.orders WHERE COALESCE(total, 0) = 0 AND created_date > now() - interval '30 days') AS downloads_30,
  (SELECT COUNT(*)::int FROM public.silence_sessions WHERE created_at > now() - interval '30 days') AS silence_30,
  (SELECT COUNT(*)::int FROM public.orders WHERE status = 'COMPLETED' AND COALESCE(total, 0) > 0 AND created_date > now() - interval '30 days') AS paid_30,
  (SELECT COUNT(*)::int FROM public.orders o WHERE o.status = 'COMPLETED' AND jsonb_typeof(to_jsonb(o)->'invoice') = 'object'
     AND COALESCE((to_jsonb(o)->'invoice'->>'wystawiona')::boolean, false) = false) AS invoices_todo`;

const CONTACTS_SQL = `SELECT * FROM (
  SELECT 'Kontakt' AS source, name, email, NULL::text AS phone, created_date::timestamptz AS at FROM public.contact_messages
  UNION ALL SELECT 'Podcast', full_name, email, phone, created_date::timestamptz FROM public.podcast_applications
  UNION ALL SELECT 'Powrót', full_name, email, phone, created_date::timestamptz FROM public.powrot_applications
  UNION ALL SELECT 'Zamówienie', buyer_name, buyer_email, buyer_phone, created_date::timestamptz FROM public.orders
  UNION ALL SELECT 'Spotkanie', first_name, email, NULL, created_at::timestamptz FROM public.registrations
  UNION ALL SELECT 'Lista oczekujących', first_name, email, NULL, created_at::timestamptz FROM public.waitlist
  UNION ALL SELECT 'Newsletter', name, email, NULL, created_date::timestamptz FROM public.subscribers
) c ORDER BY at DESC NULLS LAST LIMIT 2000`;

// ============ Gotowość platformy ============
// Lista kontrolna: co jeszcze trzeba ustawić, żeby sprzedaż, maile i spotkania działały.
// Zwracamy WYŁĄCZNIE wartości tak/nie i liczby — nigdy treści kluczy, haseł ani adresów.
// Jedno wywołanie przy otwarciu pulpitu; wynik trzymany 60 s w pamięci instancji.
const READY_SQL = `SELECT
  (SELECT COUNT(*)::int FROM public.events
     WHERE status = 'Opublikowane' AND format = 'Online' AND COALESCE(join_link, '') = ''
       AND start_datetime >= now() AND start_datetime < now() + interval '14 days') AS events_no_link,
  (SELECT COUNT(*)::int FROM public.products
     WHERE active = TRUE AND COALESCE(status, 'dostępny') NOT IN ('wkrótce', 'ukryty')
       AND COALESCE(is_free, false) = FALSE AND product_type IN ('pdf', 'audio', 'wideo')
       AND COALESCE(private_file_uri, '') = '' AND COALESCE(file_url, '') = '') AS products_no_file,
  (SELECT COUNT(*)::int FROM public.bk_types WHERE active = TRUE AND COALESCE(zoom_link, '') = '') AS bk_no_zoom,
  (SELECT mode FROM public.bk_settings WHERE id = 1) AS bk_mode,
  (SELECT COALESCE(google_calendar_id, '') <> '' FROM public.bk_settings WHERE id = 1) AS gcal_used,
  (SELECT google_status FROM public.bk_settings WHERE id = 1) AS gcal_status,
  (SELECT google_error IS NOT NULL FROM public.bk_settings WHERE id = 1) AS gcal_error,
  (SELECT COUNT(*)::int FROM public.orders o
     WHERE o.status = 'COMPLETED' AND COALESCE(o.total, 0) > 0
       AND COALESCE(to_jsonb(o)->>'invoice_id', '') = ''
       AND COALESCE(o.payu_order_id, '') NOT LIKE 'FREE-%'
       AND o.updated_date < now() - interval '10 minutes'
       AND o.updated_date > now() - interval '7 days') AS invoices_missing`;

let READY = null, READY_AT = 0;

async function readiness(base44) {
  if (READY && Date.now() - READY_AT < 60000) return READY;
  const [row] = await runSql(base44, READY_SQL, true);
  const [payu, smtp, firma, zoom, fakturyRaw] = (await Promise.all([
    getSetting(base44, "payu").catch(() => null),
    getSetting(base44, "smtp").catch(() => null),
    getSetting(base44, "firma").catch(() => null),
    getSetting(base44, "zoom_staly").catch(() => null),
    getSetting(base44, "faktury").catch(() => null),
  ])) as any[];
  // Kolejka maili: ten sam odczyt co w panelu poczty (kolejka jest krótka — same oczekujące wiadomości).
  const queued = (await base44.asServiceRole.entities.MailQueue
    .filter({ status: "kolejka" }, "created_date", 1000).catch(() => [])).length;
  // Ostatnia kopia zapasowa — tylko data i rozmiar, bez treści.
  const lastBackup = (await base44.asServiceRole.entities.BackupFile
    .filter({ status: "gotowa" }, "-created_date", 1).catch(() => []))[0] || null;
  // Łącznik Google Calendar: sprawdzamy samo połączenie (token zostaje na serwerze).
  const gcalConn = await base44.asServiceRole.connectors
    .getConnection("googlecalendar").then(() => true).catch(() => false);

  const mailOk = mailReady(smtp);
  const payuMissing = [["posId", "POS ID"], ["clientId", "Client ID"], ["clientSecret", "Client Secret"], ["secondKey", "klucz drugi"]]
    .filter(([k]) => !payu?.[k]).map(([, l]) => l);
  const firmaMissing = [["nazwa", "nazwa firmy"], ["adres", "adres"], ["nip", "NIP"]]
    .filter(([k]) => !String(firma?.[k] || "").trim()).map(([, l]) => l);

  const hasFixedZoom = !!String(zoom?.link || "").trim();
  const bkOff = String(row?.bk_mode || "off") === "off";
  const bkNoZoom = Number(row?.bk_no_zoom || 0);
  const bkParts = [];
  if (!hasFixedZoom) bkParts.push("brak stałego linku Zoom");
  if (bkNoZoom > 0) bkParts.push(`brak linku w ${bkNoZoom} aktywnych rodzajach`);
  if (bkOff) bkParts.push("rezerwacje 1:1 wyłączone");

  const gcalConnected = gcalConn || !!row?.gcal_used;
  const gcalErr = String(row?.gcal_status || "") === "error" || !!row?.gcal_error;
  const eventsNoLink = Number(row?.events_no_link || 0);
  const productsNoFile = Number(row?.products_no_file || 0);
  const backupAt = lastBackup?.created_at || lastBackup?.created_date || null;
  const backupDays = backupAt ? Math.floor((Date.now() - Date.parse(backupAt)) / 86400000) : null;

  // Faktury: włączone + token + nazwa konta = gotowe. Zaległe dokumenty to ostrzeżenie, nie błąd.
  let fak: any;
  try {
    fak = cleanFaktury(fakturyRaw);
  } catch {
    fak = { ...FAKTURY_DEFAULT };
  }
  const fakToken = fakturyToken();
  const fakOn = fak.wlaczona && !!fakToken && !!fak.subdomena;
  const fakMissing = [!fakToken ? "token API" : "", !fak.subdomena ? "nazwa konta" : ""].filter(Boolean).join(", ");
  const invoicesMissing = Number(row?.invoices_missing || 0);

  const items = [
    {
      id: "email",
      title: "Wysyłka e-mail",
      status: !mailOk ? "err" : queued > 0 ? "warn" : "ok",
      detail: !mailOk
        ? "Nieskonfigurowana albo ostatni test się nie udał — maile czekają w kolejce."
        : queued > 0
        ? `Działa. W kolejce czeka ${queued} wiadomości.`
        : "Działa, ostatni test udany. Kolejka pusta.",
      to: "/admin/ustawienia",
    },
    {
      id: "payu",
      title: "Płatności PayU",
      status: payuMissing.length ? "err" : "ok",
      detail: payuMissing.length
        ? `Brakuje: ${payuMissing.join(", ")}.`
        : `Klucze ustawione · tryb: ${payu?.env === "sandbox" ? "sandbox (testowy)" : "produkcja"}.`,
      to: "/admin/integracje",
    },
    {
      id: "faktury",
      title: "Faktury (Fakturownia)",
      status: !fak.wlaczona ? "ok" : !fakOn ? "err" : invoicesMissing ? "warn" : "ok",
      detail: !fak.wlaczona
        ? "Wyłączone — faktury wystawiasz ręcznie."
        : !fakOn
        ? `Włączone, ale brakuje: ${fakMissing}.`
        : invoicesMissing
        ? `Działa. ${invoicesMissing} opłaconych zamówień czeka na fakturę — sprawdź Zamówienia.`
        : `Działa · konto ${fak.subdomena} · osoba prywatna: ${DOKUMENT_OSOBA[fak.dokument_osoba]}.`,
      to: "/admin/ustawienia",
    },
    {
      id: "firma",
      title: "Dane firmy",
      status: firmaMissing.length ? "warn" : "ok",
      detail: firmaMissing.length
        ? `Brakuje: ${firmaMissing.join(", ")} — na stronach prawnych widać „…”.`
        : "Nazwa, adres i NIP wypełnione.",
      to: "/admin/ustawienia",
    },
    {
      id: "rezerwacje",
      title: "Rezerwacje 1:1 i link Zoom",
      status: bkOff ? "warn" : bkParts.length ? "err" : "ok",
      detail: bkParts.length ? `${bkParts.join(", ")}.` : "Stały link Zoom i wszystkie aktywne rodzaje mają link.",
      to: "/admin/rezerwacje",
    },
    {
      id: "google",
      title: "Kalendarz Google",
      status: !gcalConnected ? "warn" : gcalErr ? "warn" : "ok",
      detail: !gcalConnected
        ? "Niepodłączony — rezerwacje nie trafiają do kalendarza."
        : gcalErr
        ? "Podłączony, ale ostatnia synchronizacja zgłosiła błąd."
        : "Podłączony, kalendarz się synchronizuje.",
      to: "/admin/rezerwacje",
    },
    {
      id: "events",
      title: "Spotkania online z linkiem",
      status: eventsNoLink ? "err" : "ok",
      detail: eventsNoLink
        ? `${eventsNoLink} spotkań online bez linku do dołączenia (najbliższe 14 dni).`
        : "Wszystkie najbliższe spotkania online mają link.",
      to: "/admin/spotkania",
    },
    {
      id: "backup",
      title: "Kopia zapasowa danych",
      status: !lastBackup || backupDays > 8 ? "warn" : "ok",
      detail: !lastBackup
        ? "Jeszcze nie ma kopii — powstanie w niedzielę ok. 3:30 albo zrób ją w panelu."
        : `Ostatnia ${backupDays === 0 ? "dziś" : backupDays === 1 ? "wczoraj" : `${backupDays} dni temu`} · ${(Number(lastBackup.size || 0) / 1024 / 1024).toFixed(1)} MB.`,
      to: "/admin/ustawienia",
    },
    {
      id: "products",
      title: "Pliki w płatnych produktach",
      status: productsNoFile ? "err" : "ok",
      detail: productsNoFile
        ? `${productsNoFile} płatnych produktów bez pliku i bez dostępu.`
        : "Wszystkie płatne produkty mają plik albo dostęp.",
      to: "/admin/skarbiec",
    },
  ];

  READY = { items, ok: items.filter((i) => i.status === "ok").length, total: items.length };
  READY_AT = Date.now();
  return READY;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    if (body.action === "readiness") {
      return Response.json(await readiness(base44));
    }
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