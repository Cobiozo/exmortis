import React, { useEffect, useRef, useState } from "react";
import { Trash2, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PowrotAppCard from "./PowrotAppCard";
import PowrotDeleteDialog from "./PowrotDeleteDialog";
import { STATUS_LABEL, TABS } from "./powrotTemplates";
import { POWROT } from "@/lib/powrotOffer";

// Kandydaci i uczestnicy POWRÓT (v2, 18.11.2026): zakładki według etapu, wskaźniki lejka,
// sygnał „czeka ponad 48 h” (obietnica odpowiedzi w 72 h) i nieprzeczytane wiadomości uczestników.
const hoursSince = (v) => (v ? (Date.now() - new Date(v).getTime()) / 36e5 : 0);

function Stat({ label, value, hint }) {
  return (
    <div className="border hairline rounded-xl px-4 py-3 min-w-[120px]">
      <p className="technical text-[9px] text-foreground/45">{label}</p>
      <p className="text-xl text-[#F5EFE1] mt-1">{value}</p>
      {hint && <p className="text-[11px] text-foreground/45 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function PowrotPanel() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("decyzja");
  const [openId, setOpenId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = () =>
    base44.functions
      .invoke("adminPowrot", { action: "list" })
      .then((r) => { setRows(r.data.applications || []); setStats(r.data.stats || null); setLoadError(""); })
      .catch((e) => { setRows([]); setLoadError(e?.response?.data?.error || "Nie udało się wczytać zgłoszeń."); });

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = rows?.find((r) => r.id === openId) || null;

  // Wejście z Bazy kontaktów: /admin/powrot?email=... od razu otwiera kartę tego zgłoszenia.
  const mailFromUrl = new URLSearchParams(window.location.search).get("email");
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !rows || !mailFromUrl) return;
    autoOpened.current = true;
    const match = rows.find((r) => String(r.email || "").toLowerCase() === mailFromUrl.toLowerCase());
    if (match) { setOpenId(match.id); setTab("wszystkie"); }
  }, [rows, mailFromUrl]);

  const del = rows?.find((r) => r.id === delId) || null;
  const remove = async () => {
    if (!del) return;
    setDeleting(true);
    try {
      await base44.functions.invoke("adminPowrot", { action: "delete", id: del.id });
      if (openId === del.id) setOpenId(null);
      setDelId(null);
      await load();
      setNotice("Zgłoszenie usunięte razem z notatkami, historią i wiadomościami.");
    } catch (e) {
      setNotice(e?.response?.data?.error || "Nie udało się usunąć zgłoszenia.");
      setDelId(null);
    } finally {
      setDeleting(false);
    }
  };

  if (rows === null) return <p className="text-sm text-foreground/50">Ładowanie…</p>;

  const def = TABS.find((t) => t.key === tab);
  const inTab = (r, t) => !t.statuses || t.statuses.includes(r.status || "nowe");
  const shown = rows.filter((r) => inTab(r, def));
  const s = stats || {};
  const perPerson = s.przyjeci ? Math.round((s.czas_min || 0) / s.przyjeci) : null;

  return (
    <div className="space-y-4">
      {loadError && <p className="text-sm blood-text">{loadError}</p>}
      {stats && (
        <div className="flex flex-wrap gap-3">
          <Stat label="ZGŁOSZENIA" value={s.zgloszenia} />
          <Stat label="ANKIETY" value={`${s.ankiety_wypelnione}/${s.ankiety_wyslane}`} hint="wypełnione / wysłane" />
          <Stat label="ZAPROSZENIA" value={s.zaproszenia} />
          <Stat label="ROZMOWY ODBYTE" value={s.rozmowy_odbyte} />
          <Stat label="OFERTY" value={s.oferty} />
          <Stat label="PRZYJĘCI" value={s.przyjeci} hint={`w programie: ${s.aktywni}/${POWROT.capacity}`} />
          <Stat label="ODROCZENIA I INNE" value={s.odroczenia} />
          <Stat label="CZAS NA PRZYJĘTEGO" value={perPerson != null ? `${perPerson} min` : "—"} hint={`łącznie ${s.czas_min} min`} />
          <Stat label="PRZYCHÓD (OPŁACONE)" value={`${Number(s.przychod || 0).toLocaleString("pl-PL")} zł`} />
        </div>
      )}
      {notice && <p className="text-xs gold-text">{notice}</p>}
      {open && (
        <PowrotAppCard key={open.id} a={open} onDelete={() => setDelId(open.id)} onReload={load} onClose={() => setOpenId(null)} />
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Etap">
        {TABS.map((t) => {
          const n = rows.filter((r) => inTab(r, t)).length;
          return (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-1.5 text-xs ${tab === t.key ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10" : "hairline text-foreground/60"}`}>
              {t.label} · {n}
            </button>
          );
        })}
      </div>
      <div className="overflow-x-auto border hairline rounded-xl">
        <table className="w-full text-sm">
          <thead className="technical text-[9px] text-foreground/40 text-left">
            <tr><th className="p-3">DATA</th><th className="p-3">OSOBA</th><th className="p-3">STATUS</th><th className="p-3">OZNACZENIA</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const late = (r.status || "nowe") === "nowe" && hoursSince(r.created_date) > 48;
              return (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="border-t hairline cursor-pointer hover:bg-[#121212]">
                  <td className="p-3 text-foreground/50 whitespace-nowrap">{new Date(r.created_date).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">{r.full_name}<span className="block text-xs text-foreground/45">{r.email}</span></td>
                  <td className="p-3 text-foreground/70">{STATUS_LABEL[r.status || "nowe"]}<span className="block text-[11px] text-foreground/40">{r.status_at ? `od ${new Date(r.status_at).toLocaleDateString("pl-PL")}` : ""}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.pilne && <span className="bg-[#BC1E22] text-[#F5EFE1] technical text-[9px] px-2 py-0.5 rounded">SPRAWDŹ PILNIE</span>}
                      {late && <span className="border border-[#E8C547] text-[#E8C547] text-[10px] px-2 py-0.5 rounded">czeka {Math.floor(hoursSince(r.created_date))} h · odpowiedź do 72 h</span>}
                      {r.unread > 0 && <span className="gold-text text-xs inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{r.unread}</span>}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setDelId(r.id); }} title="Usuń zgłoszenie" aria-label="Usuń zgłoszenie" className="p-1 text-foreground/40 hover:text-[#BC1E22]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={5} className="p-6 text-foreground/45">Brak osób w tej zakładce.</td></tr>}
          </tbody>
        </table>
      </div>
      <PowrotDeleteDialog app={del} open={!!del} onOpenChange={(v) => { if (!v) setDelId(null); }} onConfirm={remove} busy={deleting} />
    </div>
  );
}
