import React, { useEffect, useState } from "react";
import CompanyWarning from "./settings/CompanyWarning";
import MailWarning from "./mail/MailWarning";
import ZoomWarning from "./events/ZoomWarning";
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
  const cls = "block text-left bg-[#0A0A0B] p-8 border hairline hover:border-[#C9A24A] transition-colors";
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
  useEffect(() => { base44.entities.PodcastApplication.count({ status: "nowe" }).then(setNewApps).catch(() => setNewApps(0)); }, []);
  useEffect(() => {
    base44.entities.SilenceTrack.filter({}, { limit: 200 }).then((p) => setSound(p.items));
  }, []);

  return (
    <>
    <CompanyWarning />
    <MailWarning />
    <ZoomWarning items={s?.zoom_missing} />
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Tile to="/admin/obok" label="17" title="Obok" lines={["Serie, nagrania, uczestnicy"]} />
      <Tile to="/admin/ustawienia" label="16" title="Ustawienia strony" lines={["Dane firmy", "Tryb przedpremierowy", "Wysyłka e-mail"]} />
      <Tile to="/admin/spotkania" label="01" title="Spotkania" lines={[`Nadchodzące: ${v("upcoming_events")}`, `Zapisani: ${v("upcoming_registrations")}`, `Szkice: ${v("draft_events")}`]} />
      <Tile to="/admin/cisza" label="02" title="Cisza" lines={[`Utwory: ${sound ? sound.length : "…"}`, `Ostrzeżenia: ${sound ? countWarnings(sound) : "…"}`, `Rozpoczęcia (30 dni): ${v("silence_30")}`]} />
      <Tile to="/admin/skarbiec" label="03" title="Skarbiec" lines={[`Dostępne: ${v("products_available")}`, `Wkrótce: ${v("products_soon")}`, `Ukryte: ${v("products_hidden")}`]} />
      <Tile to="/admin/statystyki" label="04" title="Statystyki" lines={["Ostatnie 30 dni:", `Zapisy: ${v("reg_30")}`, `Pobrania: ${v("downloads_30")}`, `Rozpoczęcia ciszy: ${v("silence_30")}`]} />
      <Tile to="/admin/glos" label="05" title="Głos" lines={["Utwory i podcasty"]} />
      <Tile to="/admin/kontakty" label="06" title="Baza kontaktów" lines={["Wszystkie formularze w jednym miejscu", `Nowe zgłoszenia do podcastu: ${newApps ?? "…"}`]} />
      <Tile to="/admin/podcast" label="15" title="Podcast" lines={["Odcinki, playlisty, goście, ustawienia"]} />
      <Tile to="/admin/newsletter" label="07" title="Newsletter" lines={["Subskrybenci, grupy, kampanie"]} />
      <Tile to="/admin/tresci" label="08" title="Treści stron" lines={["Edycja tekstów"]} />
      <Tile to="/admin/integracje" label="09" title="Integracje" lines={["Płatności, adres aplikacji"]} />
      <Tile to="/admin/testy" label="10" title="Wyniki testu" lines={["Odpowiedzi z testu"]} />
      <Tile to="/admin/klienci" label="11" title="Klienci i dostępy" lines={["Nadawanie, przedłużenia, dziennik odtworzeń"]} />
      <Tile to="/admin/rabaty" label="12" title="Kody rabatowe" lines={["Procent lub kwota, limity, terminy"]} />
      <Tile to="/admin/bezpieczenstwo" label="13" title="Bezpieczeństwo" lines={["Alerty, blokady, znajdź właściciela kopii"]} />
      <Tile to="/admin/dane-osoby" label="18" title="Dane osoby (RODO)" lines={["Znajdź / usuń / wyeksportuj po e-mailu", "Obie bazy naraz"]} />
      <Tile to="/" onClick={() => setMode("admin")} label="14" title="Podgląd strony" lines={["Otwórz stronę z paskiem admina"]} />
    </div>
    </>
  );
}