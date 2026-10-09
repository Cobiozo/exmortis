import React from "react";
import { fmtPl, STATUS_CLS } from "./annForm";

const B = "technical text-[10px] min-h-[44px] px-3 border border-[#3D3D3F] hover:border-[#C9A24A] hover:text-[#C9A24A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A24A]";

// Wiersz listy ogłoszeń: status, termin, odbiorcy, statystyki i akcje.
export default function AnnRow({ a, onEdit, onAct }) {
  const s = a.stats;
  return (
    <div className="border border-[#3D3D3F] p-4 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className={`technical text-[10px] ${STATUS_CLS[a.status]}`}>{a.status}{a.wazne ? " · WAŻNE" : ""}</p>
        <p className="shop-heading text-lg text-[#F5EFE1] mt-1">{a.tytul}</p>
        <p className="text-xs text-foreground/50 mt-1">
          {a.od ? fmtPl(a.od) : "od razu"} → {a.do ? fmtPl(a.do) : "bez końca"} · {a.odbiorcy === "wszyscy" ? "Wszyscy z kontem" : a.cel_nazwa}
        </p>
        {s && <p className="text-xs text-foreground/70 mt-1">Odbiorcy: {s.odbiorcy} · Wyświetlenia: {s.wyswietlenia} · Kliknięcia: {s.klikniecia} · Zamknięcia: {s.zamkniecia}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={B} onClick={onEdit}>Edytuj</button>
        {["Aktywne", "Zaplanowane"].includes(a.status) && <button className={B} onClick={() => onAct("end")}>Zakończ teraz</button>}
        <button className={B} onClick={() => onAct("duplicate")}>Duplikuj</button>
        <button className={`${B} hover:!border-[#BC1E22] hover:!text-[#BC1E22]`} onClick={() => window.confirm(`Usunąć „${a.tytul}”?`) && onAct("delete")}>Usuń</button>
      </div>
    </div>
  );
}