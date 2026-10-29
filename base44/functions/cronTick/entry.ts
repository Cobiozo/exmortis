import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { waitUntil } from "base44:runtime";
import { runSql } from "../../shared/supabase.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import { APP_URL, DEFAULT_APP_URL, loadAppUrl } from "../../shared/settings.ts";
import { sendMail, adminTo, flushMailQueue } from "../../shared/smtp.ts";
import { issueInvoice, pendingInvoices, loadFaktury } from "../../shared/invoices.ts";
import { onboardingTick } from "../../shared/onboarding.ts";
import { dailySummary } from "../../shared/dailySummary.ts";
import { importPodcastRss } from "../../shared/podcastRss.ts";
import { refreshInstagramToken } from "../../shared/instagram.ts";

// ============ Jedno zadanie cykliczne zamiast sześciu workflow ============
// Workflow „Zadania cykliczne" woła tę funkcję co 5 minut (czas polski). Tutaj, równolegle,
// idą dokładnie te same wywołania, które wcześniej robiło sześć osobnych workflowów — ta sama
// praca, ale jeden przebieg workflow zamiast sześciu (koszt 0,2 kredytu zamiast 1,2).
//
// Dostęp: sesja właściciela (workflow) albo token zadania z mb_settings. Token nie jest zapisany w plikach workflow.
// Tokenów nie zapisujemy w raporcie ani w logach — raport zawiera tylko nazwę, kod odpowiedzi i czas.

const LIMIT_MS = 110000; // jeden krok nie może zjeść całego limitu funkcji (5 minut)

// Adres aplikacji: nagłówek ustawiany przez platformę, a gdy go nie ma — adres z ustawień.
async function appOrigin(base44, req) {
  const h = req.headers.get("X-Base44-App-Url");
  if (h) return String(h).replace(/\/+$/, "");
  const u = await loadAppUrl(base44).catch(() => null);
  return String(u || APP_URL || DEFAULT_APP_URL).replace(/\/+$/, "");
}

// Jedno wywołanie funkcji po HTTP: liczy się kod odpowiedzi i czas. Treści nie zapisujemy.
async function call(origin, job) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${origin}/functions/${job.name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.args || {}),
      signal: AbortSignal.timeout(LIMIT_MS),
    });
    return { zadanie: job.label, status: r.status, ok: r.ok, ms: Date.now() - t0 };
  } catch (e) {
    const name = String((e && e.name) || "");
    return {
      zadanie: job.label,
      status: 0,
      ok: false,
      ms: Date.now() - t0,
      blad: name === "TimeoutError" ? "przekroczony czas" : String((e && e.message) || e).slice(0, 120),
    };
  }
}

// Minuta czasu polskiego — od niej zależy, czy wypada przebieg „co 15 minut".
const warsawMinute = () =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", minute: "2-digit" }).format(new Date()));

// Godzina czasu polskiego — po niej wypada dzienne podsumowanie (22:00).
const warsawHour = () =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hour: "2-digit", hourCycle: "h23" }).format(new Date()));

// Dzień tygodnia czasu polskiego — po nim wypada tygodniowa kopia zapasowa.
const warsawIsSunday = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", weekday: "short" }).format(new Date()) === "Sun";

export default async function (req) {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Dostęp: workflow Base44 wywołuje funkcję z sesją właściciela aplikacji (administrator) — bez tokenu w plikach.
    // Zapasowo token zadania z mb_settings (porównanie w czasie stałym). Token z bazy przekazujemy dalej podzadaniom.
    const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
    const stored = rows && rows[0] ? rows[0].tick_token : null;
    const given = typeof body.tick_token === "string" ? body.tick_token : "";
    const me = await base44.auth.me().catch(() => null);
    const allowed = me?.role === "admin" || (!!stored && !!given && safeEqual(given, stored));
    if (!allowed || !stored) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const origin = await appOrigin(base44, req);
    const minute = warsawMinute();
    const quarter = minute % 15 < 5; // :00, :15, :30, :45 — jak dawne workflowy co 15 minut

    // Co 5 minut: publikacja zaplanowanych stron, wysyłka i higiena biblioteki, rozgrzanie startu i /dolacz.
    const jobs = [
      { label: "cmsScheduled", name: "cmsScheduled", args: { tick_token: stored } },
      { label: "libraryTick", name: "libraryTick", args: { tick_token: stored } },
      { label: "bootstrap/ping", name: "bootstrap", args: { ping: true } },
      { label: "eventsPublic/ping", name: "eventsPublic", args: { ping: true } },
      { label: "replikacja/delta", name: "replicateTick", args: { tick_token: stored } },
    ];

    // Co 15 minut: przypomnienia o spotkaniach, przypomnienia o rezerwacjach 1:1, ponowienia zmiany adresu.
    if (quarter) {
      const bk = await runSql(base44, `SELECT tick_token FROM public.bk_settings WHERE id = 1`, true).catch(() => null);
      const bkToken = (bk && bk[0] ? bk[0].tick_token : "") || "";
      jobs.push({ label: "eventsPublic/tick", name: "eventsPublic", args: { action: "tick", tick_token: stored } });
      jobs.push({ label: "emailChange/tick", name: "emailChange", args: { action: "tick", tick_token: stored } });
      if (bkToken) {
        jobs.push({ label: "bookingPublic/notify_tick", name: "bookingPublic", args: { action: "notify_tick", tick_token: bkToken } });
      } else {
        jobs.push({ label: "bookingPublic/notify_tick", name: "bookingPublic", args: null, status: 0, ok: false, ms: 0, blad: "brak tokenu w bk_settings" });
      }
    }

    // Raz w tygodniu: kopia zapasowa danych (niedziela ok. 3:30 czasu polskiego).
    // Blokada w app_settings (klucz 'backup_week') — jedno uruchomienie na 6 dni.
    // Kopia idzie w tle (własny limit czasu) i nie opóźnia pozostałych zadań.
    let kopia = false;
    if (warsawIsSunday() && minute >= 30 && minute < 35) {
      const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
          VALUES ('backup_week', jsonb_build_object('at', now()), now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
          WHERE public.app_settings.updated_date < now() - interval '6 days'
        RETURNING key`).catch(() => []);
      if (lock && lock.length) {
        kopia = true;
        waitUntil(
          fetch(`${origin}/functions/backupAdmin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "weekly", tick_token: stored }),
            signal: AbortSignal.timeout(240000),
          }).catch(() => {})
        );
      }
    }

    // Raz na dobę: podsumowanie dnia e-mailem (22:00 czasu polskiego, pierwsze 5 minut przebiegu).
    // Blokada w app_settings (klucz 'daily_summary') — jeden mail na dobę, także po restarcie instancji.
    // Podsumowanie idzie w tle, więc nie opóźnia pozostałych zadań, a jego błąd nie wywraca cronTick.
    let podsumowanie = false;
    if (warsawHour() === 22 && minute < 5) {
      const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
          VALUES ('daily_summary', jsonb_build_object('at', now()), now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
          WHERE public.app_settings.updated_date < now() - interval '20 hours'
        RETURNING key`).catch(() => []);
      if (lock && lock.length) {
        podsumowanie = true;
        waitUntil(dailySummary(base44).catch((e) => console.error("podsumowanie dnia", String(e?.message || e).slice(0, 200))));
      }
    }

    // Raz na godzinę (minuta polska < 5): odcinki podcastu z kanału RSS. W tle i w try/catch —
    // błąd kanału lub sieci nie wywraca przebiegu zadań cyklicznych.
    if (minute < 5) {
      try {
        waitUntil(importPodcastRss(base44).catch((e) => console.error("podcast RSS", String(e?.message || e).slice(0, 200))));
      } catch (e) {
        console.error("podcast RSS", String(e?.message || e).slice(0, 200));
      }
    }

    // Raz na dobę: odświeżenie długoterminowego tokenu Instagrama (ważny 60 dni, przedłużamy gdy
    // zostało mniej niż 20 dni) — sekcja na stronie głównej nie może zgasnąć po dwóch miesiącach.
    // Blokada w app_settings (klucz 'instagram_refresh') — najwyżej raz na 20 godzin.
    // W odpowiedzi są tylko daty i liczby: sam token nigdy nie trafia do logów ani do raportu.
    let instagram = null;
    try {
      const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
          VALUES ('instagram_refresh', jsonb_build_object('at', now()), now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
          WHERE public.app_settings.updated_date < now() - interval '20 hours'
        RETURNING key`).catch(() => []);
      if (lock?.length) {
        const r = await refreshInstagramToken(base44);
        instagram = {
          ok: !!r.ok,
          odswiezony: !!r.refreshed,
          ...(r.days_left != null ? { dni: r.days_left } : {}),
          ...(r.error ? { blad: r.error } : {}),
        };
      }
    } catch (e) {
      instagram = { ok: false, blad: String((e && e.message) || e).slice(0, 120) };
    }

    // Równolegle, partiami po 6 (limit połączeń workera). Błąd jednego zadania nie zatrzymuje pozostałych.
    const out = [];
    for (let i = 0; i < jobs.length; i += 6) {
      const part = jobs.slice(i, i + 6);
      const results = await Promise.allSettled(part.map((j) => (j.args ? call(origin, j) : Promise.resolve(j))));
      for (const r of results) {
        out.push(r.status === "fulfilled" ? r.value : { zadanie: "?", status: 0, ok: false, ms: 0, blad: String(r.reason).slice(0, 120) });
      }
    }

    // Faktury: ponowienie dla opłaconych zamówień bez dokumentu — najwyżej 10 na przebieg,
    // własny limit czasu (żeby nie zjadło limitu funkcji). Bez tokenu nic nie wysyłamy.
    let faktury = null;
    try {
      const f = await loadFaktury(base44);
      if (f.on) {
        const todo = await pendingInvoices(base44, f.cfg, 10);
        let wystawione = 0, bledne = 0;
        for (const o of todo) {
          if (Date.now() - t0 > LIMIT_MS - 25000) break;
          const r = await issueInvoice(base44, o);
          if (r?.ok) wystawione++; else bledne++;
        }
        faktury = { zalegle: todo.length, wystawione, bledne };
      }
    } catch (e) {
      faktury = { blad: String((e && e.message) || e).slice(0, 120) };
    }

    // Listy prowadzące po zakupie (dzień 1/3/7/14) — co 15 minut, w godzinach 8–20.
    let prowadzenie = null;
    if (quarter && Date.now() - t0 < LIMIT_MS - 60000) {
      try {
        const r = await onboardingTick(base44);
        if (r?.sent) prowadzenie = r;
      } catch (e) {
        prowadzenie = { blad: String((e && e.message) || e).slice(0, 120) };
      }
    }

    // Poczta: maile wstrzymane przez limit dostawcy wychodzą same, gdy limit się zwolni (najwyżej 40 na przebieg).
    let poczta = null;
    if (Date.now() - t0 < LIMIT_MS - 50000) {
      try {
        const r = await flushMailQueue(base44, { auto: true });
        if (r.sent || r.failed || r.more) poczta = r;
      } catch (e) {
        poczta = { blad: String((e && e.message) || e).slice(0, 120) };
      }
    }

    const failed = out.filter((c) => !c.ok);
    // Alarm dla administratora: najwyżej jeden mail na 6 godzin, tylko gdy coś nie odpowiedziało.
    if (failed.length) {
      const lock = await runSql(base44, `INSERT INTO public.app_settings (key, value, updated_date)
          VALUES ('cron_alert', jsonb_build_object('at', now()), now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_date = now()
          WHERE public.app_settings.updated_date < now() - interval '6 hours'
        RETURNING key`).catch(() => []);
      if (lock?.length) {
        const to = await adminTo(base44).catch(() => null);
        const list = failed.map((f) => `<li>${String(f.zadanie).replace(/</g, "&lt;")} — kod ${f.status}${f.blad ? `, ${String(f.blad).replace(/</g, "&lt;")}` : ""}</li>`).join("");
        if (to) await sendMail(base44, { kind: "alarm", to, subject: `exmortis: zadanie w tle nie działa (${failed.length})`,
          html: `<p>Ostatni przebieg zadań cyklicznych (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC) — nie odpowiedziały:</p><ul>${list}</ul><p>Kolejny alarm najwcześniej za 6 godzin. Jeśli powtarza się — sprawdź Panel → Pulpit → Gotowość platformy i logi funkcji.</p>` }).catch(() => {});
      }
    }
    console.log("cronTick", JSON.stringify({ minute, quarter, ok: out.length - failed.length, failed: failed.length, ...(poczta ? { poczta } : {}), ...(prowadzenie ? { prowadzenie } : {}), ...(podsumowanie ? { podsumowanie } : {}) }));
    return Response.json({
      ok: failed.length === 0,
      minuta: minute,
      co15: quarter,
      kopia_zapasowa: kopia,
      faktury,
      instagram,
      przebiegi: out,
      niepowodzenia: failed.length,
      ms: Date.now() - t0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}