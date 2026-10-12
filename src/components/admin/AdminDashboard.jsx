import React, { useEffect, useState } from "react";
import CompanyWarning from "./settings/CompanyWarning";
import MailWarning from "./mail/MailWarning";
import ZoomWarning from "./events/ZoomWarning";
import FallbackWarning from "./events/FallbackWarning";
import BookingWarnings from "./booking/BookingWarnings";
import DashboardLibraryTile from "./DashboardLibraryTile";
// Kafelek modułu biblioteki i wiadomości pokazuje się tylko, gdy którykolwiek przełącznik ≠ off.
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { trackWarnings } from "@/components/admin/silence/library/libUtils";
const countWarnings = (l) => l.reduce((n, t) => n + trackWarnings(t).length, 0);

function Tile({ to, label, title, lines, onClick }) {
  const Inner = (
    <>
      <p className="technical text-[10px] gold-text mb-3">{label}</p>
      <h3 className="relic-heading text-2xl mb-5">{title}</h3>
      <div className="space-y-1 text-sm text-foreground/60">
        {lines.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </>
  );
  // flex-col + justify-start: kafelek-przycisk wygląda tak samo jak kafelek-link (bez centrowania w pionie).
  const cls = "flex flex-col justify-start w-full text-left bg-[#0A0A0B] p-8 border hairline hover:border-[#C9A24A] transition-colors";
  return onClick ? <button onClick={onClick} className={cls}>{Inner}</button> : <Link to={to} className={cls}>{Inner}</Link>;
}

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  const { setMode } = useAdminMode();

  useEffect(() => {
    base44.functions.invoke("adminDashboard", {}).then((r) => setS(r.data.stats));
  }, []);

  const v = (k) => (s ? s[k] ?? 0 : "…");
  const [sound, setSound] = useState(null);
  const [newApps, setNewApps] = useState(null);
  const [libOn, setLibOn] = useState(false);
  useEffect(() => {
    base44.functions.invoke("libraryAdmin", { action: "settings" })
      .then((r) => setLibOn(r.data.settings.library_mode !== "off" || r.data.settings.messages_mode !== "off"))
      .catch(() => setLibOn(false));
  }, []);
  useEffect(() => { base44.entities.PodcastApplication.count({ status: "nowe" }).then(setNewApps).catch(() => setNewApps(0)); }, []);
  useEffect(() => {
    base44.entities.SilenceTrack.filter({}, { limit: 200 }).then((p) => setSound(p.items));
  }, []);

  return (
    <>
    <BookingWarnings />
    <CompanyWarning />
    <MailWarning />
    <ZoomWarning items={s?.zoom_missing} />
    <FallbackWarning />
    {(() => {
      // Kafelki w czterech grupach; numeracja liczona po kolei, więc ukryte kafelki nie robią dziur.
      const groups = [
        ["CODZIENNA PRACA", [
          { to: "/admin/spotkania", title: "Spotkania", lines: [`Nadchodzące: ${v("upcoming_events")}`, `Zapisani: ${v("upcoming_registrations")}`, `Szkice: ${v("draft_events")}`] },
          { to: "/admin/rezerwacje", title: "Rezerwacje 1:1", lines: ["Rodzaje, godziny, blokady, święta"] },
          { to: "/admin/klienci", title: "Klienci i dostępy", lines: ["Nadawanie, przedłużenia, dziennik odtworzeń"] },
          libOn && { to: "/admin/wiadomosci", lib: true },
          libOn && { to: "/admin/biblioteka", title: "Biblioteka", lines: ["Materiały, kolekcje, przydziały"] },
          libOn && { to: "/admin/grupy", title: "Grupy", lines: ["Ręczne i automatyczne, znaczniki"] },
          { to: "/admin/ogloszenia", title: "Ogłoszenia", lines: ["Na koncie klienta, bez e-maili"] },
          { to: "/admin/obok", title: "Obok", lines: ["Serie, nagrania, uczestnicy"] },
        ]],
        ["SKLEP I TREŚCI", [
          { to: "/admin/zamowienia", title: "Zamówienia", lines: [`Opłacone (30 dni): ${v("paid_30")}`, `Faktury do wystawienia: ${v("invoices_todo")}`] },
          { to: "/admin/skarbiec", title: "Skarbiec", lines: [`Dostępne: ${v("products_available")}`, `Wkrótce: ${v("products_soon")}`, `Ukryte: ${v("products_hidden")}`] },
          { to: "/admin/rabaty", title: "Kody rabatowe", lines: ["Procent lub kwota, limity, terminy"] },
          { to: "/admin/tresci", title: "Treści stron", lines: ["Edycja tekstów"] },
          { to: "/admin/menu", title: "Menu i stopka", lines: ["Nawigacja i linki w stopce"] },
          { to: "/admin/cisza", title: "Cisza", lines: [`Utwory: ${sound ? sound.length : "…"}`, `Ostrzeżenia: ${sound ? countWarnings(sound) : "…"}`, `Rozpoczęcia (30 dni): ${v("silence_30")}`] },
          { to: "/admin/glos", title: "Głos", lines: ["Utwory i podcasty"] },
          { to: "/admin/podcast", title: "Podcast", lines: ["Odcinki, playlisty, goście, ustawienia"] },
          { to: "/admin/newsletter", title: "Newsletter", lines: ["Subskrybenci, grupy, kampanie"] },
        ]],
        ["DANE I WYNIKI", [
          { to: "/admin/statystyki", title: "Statystyki", lines: ["Ostatnie 30 dni:", `Zapisy: ${v("reg_30")}`, `Pobrania: ${v("downloads_30")}`, `Rozpoczęcia ciszy: ${v("silence_30")}`] },
          { to: "/admin/kontakty", title: "Baza kontaktów", lines: ["Wszystkie formularze w jednym miejscu", `Nowe zgłoszenia do podcastu: ${newApps ?? "…"}`] },
          { to: "/admin/testy", title: "Wyniki testu", lines: ["Odpowiedzi z testu"] },
        ]],
        ["USTAWIENIA I BEZPIECZEŃSTWO", [
          { to: "/admin/ustawienia", title: "Ustawienia strony", lines: ["Dane firmy", "Tryb przedpremierowy", "Wysyłka e-mail", "Mój stały link Zoom"] },
          { to: "/admin/integracje", title: "Integracje", lines: ["Płatności, adres aplikacji"] },
          { to: "/admin/bezpieczenstwo", title: "Bezpieczeństwo", lines: ["Alerty, blokady, znajdź właściciela kopii"] },
          { to: "/admin/dane-osoby", title: "Dane osoby (RODO)", lines: ["Znajdź / usuń / wyeksportuj po e-mailu", "Obie bazy naraz"] },
          libOn && { to: "/admin/historia", title: "Historia zmian", lines: ["Biblioteka, grupy, wiadomości"] },
          { to: "/", title: "Podgląd strony", lines: ["Otwórz stronę z paskiem admina"], onClick: () => setMode("admin") },
        ]],
      ];
      let n = 0;
      const num = () => String(++n).padStart(2, "0");
      return (
        <div className="space-y-12">
          {groups.map(([name, items]) => (
            <section key={name}>
              <p className="technical text-[10px] text-foreground/45 mb-4">{name}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.filter(Boolean).map((t) => (t.lib
                  ? <DashboardLibraryTile key={t.to} label={num()} />
                  : <Tile key={t.to} to={t.to} label={num()} title={t.title} lines={t.lines} onClick={t.onClick} />))}
              </div>
            </section>
          ))}
        </div>
      );
    })()}
    </>
  );
}