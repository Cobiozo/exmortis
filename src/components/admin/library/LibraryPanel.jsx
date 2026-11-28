import React, { useEffect, useState } from "react";
import { lib } from "./libApi";
import LibraryDisabled from "./LibraryDisabled";
import MaterialsTab from "./MaterialsTab";
import CollectionsTab from "./CollectionsTab";
import { ViewTabs, SkeletonList } from "@/components/admin/ui/kit";

const TABS = [["materialy", "Materiały"], ["kolekcje", "Kolekcje"]];

// Sekcja panelu „Biblioteka". Przy obu przełącznikach „off" pokazuje tylko informację.
export default function LibraryPanel() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("materialy");

  useEffect(() => {
    lib("settings").then((d) => setS(d.settings)).catch(() => setS({ library_mode: "off", messages_mode: "off" }));
  }, []);

  if (!s) return <SkeletonList rows={3} />;
  if (s.library_mode === "off" && s.messages_mode === "off") return <LibraryDisabled />;

  return (
    <div className="space-y-8">
      <ViewTabs tabs={TABS} value={tab} onChange={setTab} label="Biblioteka" />
      {tab === "materialy" ? <MaterialsTab /> : <CollectionsTab />}
    </div>
  );
}