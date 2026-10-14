import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";
import { safeEqual } from "../../shared/libraryAccess.ts";
import { APP_URL, DEFAULT_APP_URL, loadAppUrl } from "../../shared/settings.ts";
import { sendMail, adminTo } from "../../shared/smtp.ts";

// ============ Jedno zadanie cykliczne zamiast sześciu workflow ============
// Workflow „Zadania cykliczne" woła tę funkcję co 5 minut (czas polski). Tutaj, równolegle,
// idą dokładnie te same wywołania, które wcześniej robiło sześć osobnych workflowów — ta sama
// praca, ale jeden przebieg workflow zamiast sześciu (koszt 0,2 kredytu zamiast 1,2).
//
// Dostęp: wyłącznie token zadania z mb_settings (jak w Bibliotece i Stronach). Bez tokenu 403.
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

export default async function (req) {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Dostęp: token zadania z mb_settings (porównanie w czasie stałym).
    const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
    const stored = rows && rows[0] ? rows[0].tick_token : null;
    const given = typeof body.tick_token === "string" ? body.tick_token : "";
    if (!stored || !given || !safeEqual(given, stored)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const origin = await appOrigin(base44, req);
    const minute = warsawMinute();
    const quarter = minute % 15 < 5; // :00, :15, :30, :45 — jak dawne workflowy co 15 minut

    // Co 5 minut: publikacja zaplanowanych stron, wysyłka i higiena biblioteki, rozgrzanie startu i /dolacz.
    const jobs = [
      { label: "cmsScheduled", name: "cmsScheduled", args: { tick_token: given } },
      { label: "libraryTick", name: "libraryTick", args: { tick_token: given } },
      { label: "bootstrap/ping", name: "bootstrap", args: { ping: true } },
      { label: "eventsPublic/ping", name: "eventsPublic", args: { ping: true } },
    ];

    // Co 15 minut: przypomnienia o spotkaniach, przypomnienia o rezerwacjach 1:1, ponowienia zmiany adresu.
    if (quarter) {
      const bk = await runSql(base44, `SELECT tick_token FROM public.bk_settings WHERE id = 1`, true).catch(() => null);
      const bkToken = (bk && bk[0] ? bk[0].tick_token : "") || "";
      jobs.push({ label: "eventsPublic/tick", name: "eventsPublic", args: { action: "tick" } });
      jobs.push({ label: "emailChange/tick", name: "emailChange", args: { action: "tick" } });
      if (bkToken) {
        jobs.push({ label: "bookingPublic/notify_tick", name: "bookingPublic", args: { action: "notify_tick", tick_token: bkToken } });
      } else {
        jobs.push({ label: "bookingPublic/notify_tick", name: "bookingPublic", args: null, status: 0, ok: false, ms: 0, blad: "brak tokenu w bk_settings" });
      }
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
    console.log("cronTick", JSON.stringify({ minute, quarter, ok: out.length - failed.length, failed: failed.length }));
    return Response.json({
      ok: failed.length === 0,
      minuta: minute,
      co15: quarter,
      przebiegi: out,
      niepowodzenia: failed.length,
      ms: Date.now() - t0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}