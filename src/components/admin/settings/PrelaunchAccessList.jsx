import React, { useState } from "react";
import { isoToWarsawLocal, warsawLocalToIso, fmtWarsaw } from "@/lib/warsawTime";

const inp = "bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const DEFAULT_DO = "2026-11-01T21:30";

// Konta, które w trybie przedpremierowym widzą stronę jak po premierze (bez uprawnień admina).
export default function PrelaunchAccessList({ list, onSave }) {
  const [email, setEmail] = useState("");
  const [until, setUntil] = useState(DEFAULT_DO);
  const [err, setErr] = useState("");
  const add = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setErr("Podaj poprawny adres e-mail.");
    setErr("");
    onSave([...list.filter((x) => x.email !== e), { email: e, do: warsawLocalToIso(until) }], `Dodano dostęp przedpremierowy: ${e}.`);
    setEmail(""); setUntil(DEFAULT_DO);
  };
  return (
    <div className="border-t hairline mt-8 pt-8">
      <p className="technical text-[10px] gold-text mb-2">KONTA Z DOSTĘPEM PRZEDPREMIEROWYM</p>
      <p className="text-sm text-foreground/50 mb-5">Po zalogowaniu widzą pełną stronę, menu i Obok, bez uprawnień admina. Konto musi być zarejestrowane na ten e-mail.</p>
      <div className="flex flex-wrap gap-3 items-end mb-2">
        <label className="flex-1 min-w-[220px]"><span className="block technical text-[10px] text-foreground/60 mb-2">E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inp} w-full`} /></label>
        <label><span className="block technical text-[10px] text-foreground/60 mb-2">Dostęp wygasa (czas polski)</span>
          <input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} className={`${inp} dt-input relative`} /></label>
        <button onClick={add} className="btn-ghost">DODAJ</button>
      </div>
      {err && <p className="text-sm blood-text mb-2">{err}</p>}
      <ul className="mt-4">
        {list.map((x) => (
          <li key={x.email} className="flex flex-wrap items-center gap-3 py-3 border-b hairline text-sm">
            <span className="flex-1 text-[#F5EFE1]">{x.email}</span>
            <span className={Date.parse(x.do) > Date.now() ? "text-foreground/55" : "blood-text"}>do {fmtWarsaw(x.do)}</span>
            <button onClick={() => onSave(list.filter((y) => y.email !== x.email), `Usunięto dostęp: ${x.email}.`)} className="technical text-[10px] blood-text">USUŃ</button>
          </li>
        ))}
      </ul>
    </div>
  );
}