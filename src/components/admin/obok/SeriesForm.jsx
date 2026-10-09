import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { isoToWarsawLocal, warsawLocalToIso } from "@/lib/warsawTime";

const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const SEL = {
  typ: [["sekwencja", "Sekwencja (dzień po dniu)"], ["cotygodniowa", "Cotygodniowa"], ["zbior", "Zbiór (wszystkie od razu)"]],
  dostep: [["zalogowani", "Wszyscy zalogowani"], ["dolaczeni", "Tylko osoby, które dołączyły"], ["produkt", "Kupujący wybrany produkt"], ["powrot", "Uczestnicy POWRÓT (ręcznie)"], ["wybrani", "Wybrane konta (ręcznie)"]],
  po_edycji: [["automatyczny", "Automatyczny (1 od razu, potem co 24 h)"], ["wszystkie", "Wszystkie od razu"], ["zamknieta", "Zamknięta"]],
  status: [["szkic", "Szkic"], ["aktywna", "Aktywna"], ["archiwalna", "Archiwalna"]],
};
const F = ({ l, children }) => <label className="block"><span className="block technical text-[10px] text-foreground/60 mb-2">{l}</span>{children}</label>;

// Ustawienia serii.
export default function SeriesForm({ seria, onSaved }) {
  const [s, setS] = useState({ ...seria, start: seria.edycja_start ? isoToWarsawLocal(seria.edycja_start) : "" });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = async () => {
    const { start, id, created_date, updated_date, created_by_id, ...rest } = s;
    const data = { ...rest, edycja_start: start ? warsawLocalToIso(start) : null, test_minuty: Number(s.test_minuty) || 0, kolejnosc: Number(s.kolejnosc) || 0 };
    if (start) data.godzina = start.slice(11, 16);
    onSaved(await base44.entities.ObokSeria.update(seria.id, data)); setMsg("Zapisano.");
  };
  const sel = (k) => <select value={s[k] || SEL[k][0][0]} onChange={set(k)} className={`${inp} bg-[#0A0A0B]`}>{SEL[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
  return (
    <section className="border hairline p-6 md:p-8">
      <h2 className="relic-heading text-2xl mb-6">{seria.nazwa}</h2>
      <div className="grid md:grid-cols-2 gap-5">
        <F l="Nazwa"><input value={s.nazwa || ""} onChange={set("nazwa")} className={inp} /></F>
        <F l="Adres (slug) — /obok/…"><input value={s.slug || ""} onChange={set("slug")} className={inp} /></F>
        <F l="Krótki opis"><input value={s.opis_krotki || ""} onChange={set("opis_krotki")} maxLength={160} className={inp} /></F>
        <F l="Okładka (adres z Biblioteki mediów)"><input value={s.okladka || ""} onChange={set("okladka")} className={inp} /></F>
        <div className="md:col-span-2"><F l="Opis pełny"><textarea rows={4} value={s.opis || ""} onChange={set("opis")} className={inp} /></F></div>
        <F l="Typ">{sel("typ")}</F><F l="Dostęp">{sel("dostep")}</F>
        {s.dostep === "produkt" && <F l="ID produktu"><input value={s.produkt_id || ""} onChange={set("produkt_id")} className={inp} /></F>}
        {s.typ === "sekwencja" && <>
          <F l="Edycja: start i godzina odblokowania (czas polski)"><input type="datetime-local" value={s.start} onChange={set("start")} className={`${inp} dt-input relative`} /></F>
          <F l="Po zakończeniu edycji">{sel("po_edycji")}</F>
          <F l="Tryb testowy: odstęp w minutach (0 = 24 h)"><input type="number" min={0} value={s.test_minuty || 0} onChange={set("test_minuty")} className={inp} /></F>
        </>}
        <F l="Strona zapisu (adres, np. 7-wieczorow)"><input value={s.landing_slug || ""} onChange={set("landing_slug")} className={inp} /></F>
        <F l="Status">{sel("status")}</F>
        <F l="Kolejność w koncie"><input type="number" value={s.kolejnosc || 0} onChange={set("kolejnosc")} className={inp} /></F>
        <label className="flex gap-3 items-center text-sm"><input type="checkbox" checked={!!s.powiadomienia} onChange={set("powiadomienia")} className="accent-[#C9A24A]" />Powiadomienia e-mail przy odblokowaniu</label>
      </div>
      <div className="flex items-center gap-4 mt-6"><button onClick={save} className="btn-relic">ZAPISZ SERIĘ</button>{msg && <span className="text-sm gold-text">{msg}</span>}</div>
    </section>
  );
}