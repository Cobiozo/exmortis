import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib } from "./libApi";
import LibraryDisabled from "./LibraryDisabled";
import MaterialsTab from "./MaterialsTab";
import CollectionsTab from "./CollectionsTab";

const TABS = [["materialy", "Materiały"], ["kolekcje", "Kolekcje"]];

// Sekcja panelu „Biblioteka". Przy obu przełącznikach „off" pokazuje tylko informację.
export default function LibraryPanel() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("materialy");

  useEffect(() => {
    lib("settings").then((d) => setS(d.settings)).catch(() => setS({ library_mode: "off", messages_mode: "off" }));
  }, []);

  if (!s) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  if (s.library_mode === "off" && s.messages_mode === "off") return <LibraryDisabled />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 border-b hairline">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-3 technical text-[10px] border-b-2 -mb-px ${tab === k ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50 hover:gold-text"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "materialy" ? <MaterialsTab /> : <CollectionsTab />}
    </div>
  );
}