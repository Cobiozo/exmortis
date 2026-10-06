import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAdminMode } from "@/components/admin/AdminModeContext";

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
  const sil = s?.silence || {};
  const tracks = ["intro_uri", "outro_uri", "background_uri"].filter((k) => sil[k]).length;

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Tile to="/admin/spotkania" label="01" title="Spotkania" lines={[`Nadchodzące: ${v("upcoming_events")}`, `Zapisani: ${v("upcoming_registrations")}`, `Szkice: ${v("draft_events")}`]} />
      <Tile to="/admin/cisza" label="02" title="Cisza" lines={[`Podkłady: ${s ? tracks : "…"} / 3`, `Ostrzeżenia: ${s ? 3 - tracks : "…"}`]} />
      <Tile to="/admin/skarbiec" label="03" title="Skarbiec" lines={[`Dostępne: ${v("products_available")}`, `Wkrótce: ${v("products_soon")}`, `Ukryte: ${v("products_hidden")}`]} />
      <Tile to="/admin/statystyki" label="04" title="Statystyki" lines={["Ostatnie 30 dni:", `Zapisy: ${v("reg_30")}`, `Pobrania: ${v("downloads_30")}`, `Rozpoczęcia ciszy: ${v("silence_30")}`]} />
      <Tile to="/admin/glos" label="05" title="Głos" lines={["Utwory i podcasty"]} />
      <Tile to="/admin/kontakty" label="06" title="Baza kontaktów" lines={["Wszystkie formularze w jednym miejscu"]} />
      <Tile to="/admin/newsletter" label="07" title="Newsletter" lines={["Subskrybenci, grupy, kampanie"]} />
      <Tile to="/admin/tresci" label="08" title="Treści stron" lines={["Edycja tekstów"]} />
      <Tile to="/admin/integracje" label="09" title="Integracje" lines={["SMTP, płatności"]} />
      <Tile to="/admin/testy" label="10" title="Wyniki testu" lines={["Odpowiedzi z testu"]} />
      <Tile to="/" onClick={() => { setMode("admin"); window.location.href = "/"; }} label="11" title="Podgląd strony" lines={["Otwórz stronę z paskiem admina"]} />
    </div>
  );
}