import React, { useEffect, useMemo, useState } from "react";
import { siteStats } from "@/lib/siteStats";

// RUCH NA STRONIE — własny, anonimowy licznik (sumy dzienne z funkcji site_stats_get).
// Bez cookies i zgody, więc liczy wszystkich odwiedzających, ale nie rozróżnia osób: to odsłony, nie użytkownicy.
const DAY = 86400000;
const SOURCE_LABEL = {
  bezposrednio: "Bezpośrednio (wpisany adres, zakładka, aplikacja)", google: "Google", bing: "Inne wyszukiwarki",
  facebook: "Facebook / Messenger", instagram: "Instagram", youtube: "YouTube", whatsapp: "WhatsApp", tiktok: "TikTok",
  spotify: "Spotify", linkedin: "LinkedIn", listy: "E-mail / Listy powrotu", kampania: "Link oznaczony (utm)", inne: "Inne strony",
};
const EVENT_LABEL = {
  ViewContent: "Wejście na produkt", AddToCart: "Dodanie do koszyka", InitiateCheckout: "Przejście do kasy",
  free_pdf_request: "Darmowy materiał — zamówienie", view_powrot: "Wejście na POWRÓT", powrot_form_start: "Początek zgłoszenia POWRÓT",
  Lead_powrot: "Zgłoszenie POWRÓT", Lead_newsletter: "Zapis na Listy powrotu", Lead_kontakt: "Wiadomość z formularza",
  Lead_lista_oczekujacych: "Lista oczekujących", CompleteRegistration_spotkanie: "Zapis na spotkanie",
  home_start_click: "Kliknięcie w „Trzy drogi”", whatsapp_click: "Kliknięcie w WhatsApp", rozdroza_view: "Rozdroża — widok na stronie głównej",
  rozdroza_cta_click: "Rozdroża — kliknięcie", biblioteka_home_click: "Biblioteka — kliknięcie",
  home_bezplatne_click: "Strona główna — „Zobacz bezpłatne materiały”", home_ksiazka_click: "Strona główna — „Poznaj książkę”",
  cta_rozpoznanie: "Strona główna — „Poznaj drogę powrotu”", cta_o_mnie: "Strona główna — „Poznaj moją historię”",
  cta_test_src_home: "Strona główna — „Sprawdź, która śmierć jest Twoja”", test_start: "Test — start", test_complete: "Test — ukończony",
  Purchase: "Zakup opłacony",
};

function Table({ title, rows, label }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="border hairline p-5 min-w-0">
      <p className="technical text-[11px] gold-text mb-4">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-foreground/50">Brak danych w tym okresie.</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.name} className="text-sm">
              <div className="flex justify-between gap-3"><span className="truncate text-foreground/80" title={r.name}>{label ? label(r.name) : r.name}</span><span className="font-mono gold-text shrink-0">{r.n}</span></div>
              <div className="h-1 bg-foreground/10 mt-1"><div className="h-1 bg-[#C9A24A]/70" style={{ width: `${(r.n / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrafficPanel({ range }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { siteStats(90).then(setRows).catch(() => setRows(false)); }, []);

  const data = useMemo(() => {
    if (!rows) return null;
    const from = new Date(Date.now() - (range - 1) * DAY).toISOString().slice(0, 10);
    const inR = rows.filter((r) => String(r.day) >= from);
    const group = (kind) => {
      const m = new Map();
      for (const r of inR.filter((x) => x.kind === kind)) m.set(r.name, (m.get(r.name) || 0) + Number(r.n || 0));
      return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
    };
    const pages = group("strona");
    const days = new Set(inR.filter((r) => r.kind === "strona").map((r) => String(r.day))).size;
    const total = pages.reduce((s, r) => s + r.n, 0);
    return { pages, sources: group("zrodlo"), events: group("zdarzenie"), total, days };
  }, [rows, range]);

  if (rows === false) return <p className="text-sm text-foreground/55 mb-10">Nie udało się wczytać statystyk ruchu.</p>;
  if (!data) return <div className="py-6 flex justify-center"><div className="w-6 h-6 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>;

  return (
    <div className="mb-12">
      <p className="technical text-[11px] gold-text mb-2">RUCH NA STRONIE</p>
      <p className="text-sm text-foreground/70 mb-6">
        {data.total} odsłon w ostatnich {range} dniach{data.days ? ` (średnio ${Math.round(data.total / data.days)} dziennie w dniach z ruchem)` : ""}.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        <Table title="NAJCZĘŚCIEJ OGLĄDANE" rows={data.pages.slice(0, 15)} />
        <Table title="SKĄD PRZYCHODZĄ" rows={data.sources} label={(n) => SOURCE_LABEL[n] || n} />
        <Table title="KROKI I KLIKNIĘCIA" rows={data.events.slice(0, 15)} label={(n) => EVENT_LABEL[n] || n} />
      </div>
      <p className="text-xs text-foreground/50 mt-4">
        Własny licznik exmortis: tylko sumy dzienne, bez cookies, adresów IP i danych osobowych, więc liczy wszystkie wizyty, także bez zgody.
        To odsłony, a nie liczba osób. Źródło wejścia liczone raz na wizytę. Panel, konto i strony z prywatnym linkiem nie są liczone. Dane od 17.11.2026.
      </p>
    </div>
  );
}
