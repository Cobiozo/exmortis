import React, { useCallback, useEffect, useState } from "react";
import { bk } from "./api";
import ModeSettings from "./ModeSettings";
import TypeEditor from "./TypeEditor";
import BlocksPanel from "./BlocksPanel";
import HolidaysPanel from "./HolidaysPanel";
import BookingsList from "./BookingsList";
import PackagesPanel from "./PackagesPanel";
import BookingDashboard from "./BookingDashboard";
import BookingCalendar from "./BookingCalendar";
import BookForClient from "./BookForClient";
import IcalPanel from "./IcalPanel";
import MailTextsPanel from "./MailTextsPanel";

const TABS = [["pulpit", "Pulpit"], ["kalendarz", "Kalendarz"], ["rezerwacje", "Rezerwacje"], ["pakiety", "Pakiety"],
  ["rodzaje", "Rodzaje i godziny"], ["blokady", "Blokady"], ["swieta", "Święta"], ["emaile", "E-maile"], ["ustawienia", "Ustawienia"]];

export default function BookingAdmin() {
  const [tab, setTab] = useState("ustawienia");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => bk("get").then(setData).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (err) return <p className="blood-text text-sm">{err}</p>;
  if (!data) return <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />;
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`technical text-[10px] px-4 py-2 border ${tab === k ? "border-[#C9A24A] gold-text" : "hairline text-foreground/60"}`}>{l}</button>
        ))}
      </div>
      {tab === "pulpit" && <BookingDashboard onGo={setTab} />}
      {tab === "kalendarz" && (
        <div className="space-y-10">
          <BookingCalendar />
          <BookForClient types={data.types} onDone={load} />
          <IcalPanel />
        </div>
      )}
      {tab === "emaile" && <MailTextsPanel />}
      {tab === "ustawienia" && <ModeSettings settings={data.settings} types={data.types} onSaved={load} />}
      {tab === "rodzaje" && <div className="space-y-8">{data.types.map((t) => <TypeEditor key={t.id} type={t} onSaved={load} />)}</div>}
      {tab === "blokady" && <BlocksPanel blocks={data.blocks} onSaved={load} />}
      {tab === "swieta" && <HolidaysPanel holidays={data.holidays} onSaved={load} />}
      {tab === "rezerwacje" && <BookingsList />}
      {tab === "pakiety" && <PackagesPanel />}
    </div>
  );
}