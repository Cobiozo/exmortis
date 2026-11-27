import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink, Mic, Music, PenLine, Settings } from "lucide-react";
import EpisodesTab from "@/components/admin/podcast/EpisodesTab";
import PlaylistsTab from "@/components/admin/podcast/PlaylistsTab";
import GuestsTab from "@/components/admin/podcast/GuestsTab";
import SettingsTab from "@/components/admin/podcast/SettingsTab";
import SongsTab from "@/components/admin/podcast/SongsTab";
import MusicPlaylistsTab from "@/components/admin/podcast/MusicPlaylistsTab";
import ApplicationsTab from "@/components/admin/applications/ApplicationsTab";
import { APP } from "@/components/admin/applications/appUtils";
import PlaysBox from "./PlaysBox";

// Głos w panelu (27.11.2026): jedna sekcja zamiast „Głos” i „Podcast” — jak na stronie /glos:
// Podcast (odcinki, sezony i serie, goście, zgłoszenia gości), Muzyka (utwory, playlisty), Ustawienia.
// Widok i zakładka w adresie (?widok=muzyka&tab=utwory), więc link z maila albo zakładki przeglądarki trafia w to samo miejsce.
const AREAS = [
  ["podcast", "Podcast", Mic, [
    ["odcinki", "Odcinki", EpisodesTab],
    ["sezony", "Sezony i serie", PlaylistsTab],
    ["goscie", "Goście", GuestsTab],
    ["zgloszenia", "Zgłoszenia gości", ApplicationsTab],
  ]],
  ["muzyka", "Muzyka", Music, [
    ["utwory", "Utwory", SongsTab],
    ["playlisty", "Playlisty muzyczne", MusicPlaylistsTab],
  ]],
  ["ustawienia", "Ustawienia", Settings, [
    ["podcast", "Podcast i RSS", SettingsTab],
    ["odtworzenia", "Odtworzenia", PlaysBox],
  ]],
];
const KEY = "exm_admin_glos";
const remembered = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export default function GlosAdmin() {
  const [params, setParams] = useSearchParams();
  const mem = remembered();
  const areaKey = AREAS.some(([k]) => k === params.get("widok")) ? params.get("widok") : AREAS.some(([k]) => k === mem.widok) ? mem.widok : "podcast";
  const area = AREAS.find(([k]) => k === areaKey);
  const tabs = area[3];
  const tabKey = tabs.some(([k]) => k === params.get("tab")) ? params.get("tab") : tabs.some(([k]) => k === mem[areaKey]) ? mem[areaKey] : tabs[0][0];
  const Cur = tabs.find(([k]) => k === tabKey)[2];
  const [fresh, setFresh] = useState(0); // nowe zgłoszenia gości

  useEffect(() => { APP.count({ status: "nowe" }).then((n) => setFresh(Number(n) || 0)).catch(() => {}); }, [areaKey, tabKey]);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ ...remembered(), widok: areaKey, [areaKey]: tabKey })); } catch { /* bez pamięci */ } }, [areaKey, tabKey]);

  const go = (widok, tab) => setParams(tab ? { widok, tab } : { widok }, { replace: true });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Głos" className="grid grid-cols-3 gap-2 sm:inline-grid sm:w-auto">
          {AREAS.map(([k, label, Icon]) => {
            const on = k === areaKey;
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => go(k)}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 border text-sm transition-colors ${on ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B] font-semibold" : "hairline text-foreground/70 hover:text-foreground hover:border-[#C9A24A]/50"}`}>
                <Icon className="h-4 w-4" /> {label}
                {k === "podcast" && fresh > 0 && <span className={`ml-1 rounded-full px-1.5 text-[10px] font-mono ${on ? "bg-[#0A0A0B] text-[#C9A24A]" : "bg-[#C9A24A] text-[#0A0A0B]"}`}>{fresh}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <Link to="/admin/tresci?slug=glos" className="inline-flex items-center gap-1.5 text-foreground/60 hover:gold-text"><PenLine className="h-3.5 w-3.5" /> Tekst strony /glos</Link>
          <a href="/glos" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-foreground/60 hover:gold-text"><ExternalLink className="h-3.5 w-3.5" /> Zobacz stronę</a>
        </div>
      </div>

      <div role="tablist" aria-label={area[1]} className="flex flex-wrap gap-2 border-b hairline">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={k === tabKey} onClick={() => go(areaKey, k)}
            className={`technical text-[10px] px-4 py-2 border-b-2 -mb-px ${k === tabKey ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50 hover:text-foreground/80"}`}>
            {label.toUpperCase()}
            {k === "zgloszenia" && fresh > 0 && <span className="ml-1.5 gold-text">({fresh})</span>}
          </button>
        ))}
      </div>

      <Cur key={`${areaKey}-${tabKey}`} />
    </div>
  );
}
