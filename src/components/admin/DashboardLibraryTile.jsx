import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { lib, gb2 } from "@/components/admin/library/libApi";

// Kafelek pulpitu: zaplanowane na dziś, przeczytanie ostatniej wysłanej, odblokowania w tym tygodniu i zajęta przestrzeń.
export default function DashboardLibraryTile({ label = "" }) {
  const [d, setD] = useState(null);

  useEffect(() => {
    lib("dashboard").then(setD).catch(() => setD(null));
  }, []);

  const last = d?.ostatnia;

  return (
    <Link to="/admin/wiadomosci" className="block text-left bg-[#0A0A0B] p-8 border hairline hover:border-[#C9A24A] transition-colors">
      <p className="technical text-[10px] gold-text mb-3">{label}</p>
      <h3 className="relic-heading text-2xl mb-5">Wiadomości</h3>
      <div className="space-y-1 text-sm text-foreground/60">
        <p>Zaplanowane na dziś: {d ? d.zaplanowane_dzis : "…"}</p>
        <p>Ostatnia wysłana: {last ? `przeczytane ${last.przeczytane} / ${last.dostarczone}` : "—"}</p>
        <p>Odblokowuje się w tym tygodniu: {d ? d.odblokowuje_sie : "…"}</p>
        <p>Zajęta przestrzeń: {d ? `${gb2(d.przestrzen?.bytes)} GB (${d.przestrzen?.procent || 0}%)` : "…"}</p>
      </div>
    </Link>
  );
}