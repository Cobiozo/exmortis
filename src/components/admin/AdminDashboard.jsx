import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Plus, Wallet, ShoppingBag, UsersRound, Download, Headphones, Gem, Newspaper, BarChart3, Contact, Library } from "lucide-react";
import { fallbackFresh } from "@/content/joinFallback";
import { STALE_TEXT } from "@/components/admin/events/FallbackBadge";
import { plWhenFull } from "@/components/exmortis/events/time";

// Pulpit — centrum zarządzania. Dane przychodzą z useDashboardData (Admin.jsx):
// undefined = jeszcze się wczytuje (szara zaślepka), null = nie udało się pobrać („—”).
// Wszystkie liczby pochodzą z tych samych funkcji serwera co na dawnym pulpicie.

const TZ = "Europe/Warsaw";
const card = "rounded-xl border hairline bg-[#111113]";
const zl = (n) => `${Number(n || 0).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;
const Sk = ({ className = "" }) => <span className={`block rounded bg-white/[0.06] animate-pulse ${className}`} />;

function CardHead({ title, to, link, right }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b hairline">
      <h2 className="relic-heading text-xl md:text-2xl">{title}</h2>
      {right}
      {to && <Link to={to} className="inline-flex items-center gap-1.5 text-sm gold-text hover:underline underline-offset-4">{link} <ArrowRight className="h-3.5 w-3.5" /></Link>}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, to, loading }) {
  return (
    <Link to={to} className={`${card} p-5 flex flex-col gap-1 min-h-[118px] hover:border-[#C9A24A]/60 transition-colors`}>
      <span className="flex items-center gap-2 text-xs text-foreground/55"><Icon className="h-4 w-4 text-[#C9A24A]" />{label}</span>
      {loading ? <><Sk className="h-9 w-20 mt-1" /><Sk className="h-3 w-24 mt-2" /></> : (
        <>
          <span className="relic-heading normal-case text-4xl leading-tight tabular-nums">{value}</span>
          <span className="text-xs text-foreground/45">{sub}</span>
        </>
      )}
    </Link>
  );
}

const TONE = { err: "bg-[#E07A6A]", warn: "bg-[#C9A24A]", info: "bg-foreground/30" };

function todoList(d) {
  const out = [];
  const s = d.stats || {};
  if (d.bookingKeys === false) out.push({ tone: "err", title: "Brak kluczy bezpieczeństwa rezerwacji", detail: "Rezerwacje są niedostępne, dopóki w sekretach aplikacji nie będzie obu kluczy.", to: "/admin/rezerwacje", cta: "Sprawdź" });
  (s.zoom_missing || []).forEach((e) => out.push({ tone: "err", title: `Spotkanie bez linku do Zoom: „${e.title}”`, detail: plWhenFull(e.start), to: "/admin/spotkania", cta: "Uzupełnij" }));
  (d.ready?.items || []).filter((i) => i.status !== "ok").forEach((i) => out.push({ tone: i.status === "err" ? "err" : "warn", title: i.title, detail: i.detail, to: i.to, cta: "Otwórz" }));
  (d.events || []).filter((e) => fallbackFresh(e) === false).forEach((e) => out.push({ tone: "warn", title: `„${e.title}”`, detail: STALE_TEXT, to: "/admin/spotkania", cta: "Spotkania" }));
  const failed = d.orders?.summary?.fulfill_failed || 0;
  if (failed) out.push({ tone: "err", title: `${failed} opłaconych zamówień bez wydanego dostępu`, detail: "Wydanie produktu nie powiodło się — sprawdź i wznów.", to: "/admin/zamowienia", cta: "Sprawdź" });
  if (s.invoices_todo) out.push({ tone: "warn", title: `Faktury do wystawienia: ${s.invoices_todo}`, detail: "Zamówienia z prośbą o fakturę.", to: "/admin/zamowienia", cta: "Wystaw" });
  if (d.powrot) {
    const todo = d.powrot.todo || 0;
    if (todo) out.push({ tone: "warn", title: `Zgłoszenia POWRÓT — ankiety do wysłania: ${todo}`, detail: "Krótkie zgłoszenia czekają na pełną ankietę.", to: "/admin/powrot", cta: "Przejrzyj" });
  }
  if (d.podcastNew) out.push({ tone: "warn", title: `Nowe zgłoszenia do podcastu: ${d.podcastNew}`, detail: "Głos → Podcast → Zgłoszenia gości.", to: "/admin/glos?widok=podcast&tab=zgloszenia", cta: "Przejrzyj" });
  // 28.11.2026: wiadomości, opinie, decyzje POWRÓT, Rozmowa na progu, maile niedoręczone.
  const t = d.todo || {};
  if (t.contacts_new) out.push({ tone: "warn", title: `Nowe wiadomości z formularza: ${t.contacts_new}`, detail: "Ktoś napisał przez stronę Kontakt.", to: "/admin/skrzynka", cta: "Przeczytaj" });
  if (t.powrot_decision) out.push({ tone: "warn", title: `POWRÓT — do decyzji: ${t.powrot_decision}`, detail: "Zgłoszenia po ankiecie albo po rozmowie czekają na Twój krok.", to: "/admin/powrot", cta: "Otwórz" });
  if (t.prog_todo) out.push({ tone: "warn", title: `Rozmowa na progu — do działania: ${t.prog_todo}`, detail: "Opłacone bez terminu albo po spotkaniu bez podsumowania.", to: "/admin/rozmowa", cta: "Otwórz" });
  if (t.reviews_pending) out.push({ tone: "warn", title: `Opinie do sprawdzenia: ${t.reviews_pending}`, detail: "Nowe opinie czekają na publikację.", to: "/admin/skarbiec?opinie=1", cta: "Sprawdź" });
  if (t.bounces_7) out.push({ tone: "info", title: `Maile, które nie doszły (7 dni): ${t.bounces_7}`, detail: "Adres z literówką albo pełna skrzynka — popraw adres w zamówieniu.", to: "/admin/zamowienia", cta: "Sprawdź" });
  if (d.soundWarnings) out.push({ tone: "info", title: `Cisza — ostrzeżenia w utworach: ${d.soundWarnings}`, detail: "Brakujące pliki lub opisy w bibliotece dźwięków.", to: "/admin/cisza", cta: "Otwórz" });
  let via = null;
  try { via = localStorage.getItem("exm_login_via"); } catch { /* */ }
  if (via === "haslo") out.push({ tone: "info", title: "Logowanie hasłem", detail: "Do panelu zalecane jest logowanie przez Google lub z kodem z aplikacji.", to: "/admin/bezpieczenstwo", cta: "Więcej" });
  return out;
}

const STATUS = {
  COMPLETED: ["Opłacone", "bg-[#4E8A5F]/20 text-[#9FD0AA]"],
  PENDING: ["Czeka", "bg-[#C9A24A]/15 text-[#E2C27A]"],
  WAITING_FOR_CONFIRMATION: ["Czeka", "bg-[#C9A24A]/15 text-[#E2C27A]"],
  NEW: ["Czeka", "bg-[#C9A24A]/15 text-[#E2C27A]"],
  CANCELED: ["Anulowane", "bg-white/[0.07] text-foreground/60"],
  FAILED: ["Nieudane", "bg-[#BC1E22]/20 text-[#E8A39A]"],
  CREATING: ["Nieudane", "bg-[#BC1E22]/20 text-[#E8A39A]"],
};
const what = (items) => (Array.isArray(items) ? items.map((i) => i?.name || i?.title).filter(Boolean).join(", ") : "") || "—";
const shortDate = (iso) => new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: TZ });

export default function AdminDashboard({ d = {} }) {
  const s = d.stats;
  const loadingStats = s === undefined;
  const v = (k) => (s ? s[k] ?? 0 : "—");
  const todos = todoList(d);
  const todoLoading = d.stats === undefined || d.ready === undefined;

  const now = Date.now();
  const week = now + 7 * 86400000;
  const agenda = (d.events || [])
    .filter((e) => e.status === "Opublikowane" && e.start_datetime)
    .filter((e) => { const t = new Date(e.start_datetime).getTime(); return t > now - 2 * 3600000 && t < week; })
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
    .slice(0, 5);

  const orders = (d.orders?.list || []).slice(0, 5); // serwer zwraca już tylko 5 ostatnich
  const pc = d.powrot || null;

  return (
    <div className="space-y-5 pb-8">
      {/* Liczby */}
      <section aria-label="Najważniejsze liczby" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 [&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1">
        <Kpi icon={Wallet} label="Przychód w tym miesiącu" to="/admin/zamowienia" loading={d.orders === undefined}
          value={d.orders ? zl(d.orders.summary?.revenue_month) : "—"} sub={d.orders ? `opłacone: ${d.orders.summary?.paid_month ?? 0}` : ""} />
        <Kpi icon={ShoppingBag} label="Opłacone zamówienia" to="/admin/zamowienia" loading={loadingStats} value={v("paid_30")} sub="ostatnie 30 dni" />
        <Kpi icon={UsersRound} label="Zapisy na spotkania" to="/admin/statystyki" loading={loadingStats} value={v("reg_30")} sub="ostatnie 30 dni" />
        <Kpi icon={Download} label="Pobrania" to="/admin/statystyki" loading={loadingStats} value={v("downloads_30")} sub="ostatnie 30 dni" />
        <Kpi icon={Headphones} label="Rozpoczęcia ciszy" to="/admin/cisza" loading={loadingStats} value={v("silence_30")} sub="ostatnie 30 dni" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Do zrobienia */}
        <section className={`${card} xl:col-span-7 min-h-[320px] flex flex-col`}>
          <CardHead title="Do zrobienia" right={!todoLoading && <span className="text-xs text-foreground/50">{todos.length ? `${todos.length} ${todos.length === 1 ? "sprawa" : todos.length < 5 ? "sprawy" : "spraw"}` : ""}</span>} />
          {todoLoading && !todos.length ? (
            <div className="divide-y divide-white/[0.05]">
              {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-3 px-5 py-4"><Sk className="h-2 w-2 rounded-full" /><Sk className="h-3 w-3/5" /></div>)}
            </div>
          ) : todos.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {todos.map((t, i) => (
                <li key={i}>
                  <Link to={t.to} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.025] transition-colors">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${TONE[t.tone]}`} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{t.title}</span>
                      {t.detail && <span className="block text-xs text-foreground/55 mt-0.5">{t.detail}</span>}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-sm gold-text whitespace-nowrap">{t.cta} <ArrowRight className="h-3.5 w-3.5" /></span>
                    <ArrowRight className="sm:hidden h-4 w-4 gold-text shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-3 px-5 py-8 text-sm text-[#9FD0AA]"><Check className="h-5 w-5" /> Wszystko załatwione — nic nie czeka na Twoją decyzję.</p>
          )}
        </section>

        {/* Najbliższe 7 dni */}
        <section className={`${card} xl:col-span-5 min-h-[320px] flex flex-col`}>
          <CardHead title="Najbliższe 7 dni" to="/admin/spotkania" link="Spotkania" />
          {d.events === undefined ? (
            <div className="divide-y divide-white/[0.05]">
              {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4 px-5 py-3.5"><Sk className="h-12 w-12 rounded-lg" /><Sk className="h-3 w-1/2" /></div>)}
            </div>
          ) : agenda.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {agenda.map((e) => {
                const t = new Date(e.start_datetime);
                return (
                  <li key={e.id}>
                    <Link to="/admin/spotkania" className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.025] transition-colors">
                      <span className="w-12 shrink-0 text-center rounded-lg border border-[#C9A24A]/35 py-1">
                        <span className="block relic-heading text-xl leading-tight tabular-nums">{t.toLocaleDateString("pl-PL", { day: "numeric", timeZone: TZ })}</span>
                        <span className="block technical text-[9px] gold-text">{t.toLocaleDateString("pl-PL", { month: "short", timeZone: TZ }).replace(".", "").toUpperCase()}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{e.title}</span>
                        <span className="block text-xs text-foreground/55">
                          {t.toLocaleString("pl-PL", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })} · zapisanych: {e.registered ?? 0}{e.waitlist ? ` · rezerwowa: ${e.waitlist}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-foreground/55">Brak opublikowanych spotkań w najbliższym tygodniu.</p>
          )}
          <div className="mt-auto px-5 py-4 border-t hairline flex flex-wrap items-center gap-x-5 gap-y-3 justify-between">
            <span className="text-xs text-foreground/50">
              {loadingStats ? "…" : `Nadchodzące: ${v("upcoming_events")} · zapisanych: ${v("upcoming_registrations")} · szkice: ${v("draft_events")}`}
            </span>
            <span className="flex gap-2">
              <Link to="/admin/spotkania" className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md border hairline text-sm hover:border-[#C9A24A]"><Plus className="h-4 w-4" /> Spotkanie</Link>
              <Link to="/admin/rezerwacje" className="inline-flex items-center min-h-[36px] px-3 rounded-md border hairline text-sm hover:border-[#C9A24A]">Rezerwacje</Link>
            </span>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Ostatnie zamówienia */}
        <section className={`${card} xl:col-span-7 min-w-0`}>
          <CardHead title="Ostatnie zamówienia" to="/admin/zamowienia" link="Wszystkie" />
          {d.orders === undefined ? (
            <div className="divide-y divide-white/[0.05]">{[0, 1, 2, 3].map((i) => <div key={i} className="px-5 py-4"><Sk className="h-3 w-4/5" /></div>)}</div>
          ) : orders.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {orders.map((o) => {
                const [label, cls] = STATUS[o.status] || [o.status, "bg-white/[0.07] text-foreground/60"];
                return (
                  <li key={o.id}>
                    <Link to="/admin/zamowienia" className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-white/[0.025] transition-colors text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{what(o.items)}</span>
                        <span className="block sm:hidden text-xs text-foreground/50 truncate">{o.buyer_name || "—"} · {zl(o.total)}</span>
                      </span>
                      <span className="hidden sm:block truncate text-foreground/65">{o.buyer_name || "—"}</span>
                      <span className="hidden sm:block tabular-nums text-right">{zl(o.total)}</span>
                      <span className="flex items-center gap-2 justify-end">
                        {o.is_test && <span className="technical text-[9px] text-foreground/45">TEST</span>}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>
                        <span className="hidden md:inline text-xs text-foreground/45 w-14 text-right">{shortDate(o.created_date)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-foreground/55">{d.orders === null ? "Nie udało się wczytać zamówień." : "Nie ma jeszcze płatnych zamówień."}</p>
          )}
        </section>

        <div className="xl:col-span-5 flex flex-col gap-5">
          {/* POWRÓT */}
          <section className={card}>
            <CardHead title="Zgłoszenia POWRÓT" to="/admin/powrot" link="Otwórz" />
            <div className="grid grid-cols-3 gap-3 px-5 py-4">
              {[["Nowe (7 dni)", "fresh"], ["Ankiety do wysłania", "todo"], ["Wypełnione", "done"]].map(([l, k]) => (
                <div key={k}>
                  {pc ? <span className="block relic-heading text-3xl tabular-nums">{pc[k]}</span> : d.powrot === undefined ? <Sk className="h-8 w-10" /> : <span className="block relic-heading text-3xl">—</span>}
                  <span className="block text-xs text-foreground/55 mt-1">{l}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Szybki dostęp */}
          <section className={card}>
            <CardHead title="Szybki dostęp" />
            <div className="grid grid-cols-2 gap-2 p-4">
              {[
                ["/admin/skarbiec", "Skarbiec", loadingStats ? "…" : `Dostępne: ${v("products_available")} · wkrótce: ${v("products_soon")}`, Gem],
                ["/admin/newsletter", "Newsletter", "Subskrybenci i kampanie", Newspaper],
                ["/admin/statystyki", "Statystyki", "Lejek i wyniki", BarChart3],
                d.libOn ? ["/admin/biblioteka", "Biblioteka", "Materiały i przydziały", Library] : ["/admin/kontakty", "Baza kontaktów", "Wszystkie formularze", Contact],
              ].map(([to, title, sub, Icon]) => (
                <Link key={to} to={to} className="flex items-start gap-3 rounded-lg border hairline p-3 hover:border-[#C9A24A]/60 transition-colors">
                  <Icon className="h-4 w-4 text-[#C9A24A] mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-[11px] text-foreground/50 truncate">{sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
