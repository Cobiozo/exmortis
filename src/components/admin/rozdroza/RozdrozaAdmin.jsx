import React, { useEffect, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import StoryEditor from "./StoryEditor";

export const rz = (action, p = {}) => base44.functions.invoke("rozdrozaAdmin", { action, ...p })
  .then((r) => r.data)
  .catch((e) => { const err = new Error(e?.response?.data?.error || "Nie udało się."); err.report = e?.response?.data?.report; throw err; });

const EXAMPLE = `{
  "story": {
    "slug": "adres-historii", "title": "Tytuł", "summary": "Krótki opis",
    "category": "mentalna | duchowa | zyciowa", "estimated_minutes": 12,
    "content_warning": "", "start_scene_key": "s01",
    "cover_portrait_url": "", "cover_landscape_url": ""
  },
  "scenes": [
    { "scene_key": "s01", "scene_type": "narrative", "title": "…", "body": "…",
      "image_url": "", "alt_text": "", "next_scene_key": "s02" },
    { "scene_key": "s02", "scene_type": "decision", "title": "…", "body": "…" },
    { "scene_key": "k1", "scene_type": "ending", "title": "…", "body": "…",
      "reflection_question": "…" }
  ],
  "choices": [
    { "source_scene_key": "s02", "target_scene_key": "…", "label": "…", "sort_order": 1 }
  ]
}`;

export const statusBadge = (s) => s.status === "published"
  ? <span className={`technical text-[9px] px-2 py-1 border ${s.changed ? "border-[#E8C547]/60 text-[#E8C547]" : "border-[#9FD3A0]/50 text-[#9FD3A0]"}`}>{s.changed ? `OPUBLIKOWANA v${s.version} · ZMIANY CZEKAJĄ` : `OPUBLIKOWANA v${s.version}`}</span>
  : <span className="technical text-[9px] px-2 py-1 border hairline text-foreground/55">SZKIC</span>;

// Panel → ROZDROŻA: import historii (JSON), lista, edycja okładek i obrazów, publikacja sprawdzonych wersji.
export default function RozdrozaAdmin() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const load = () => rz("list").then((d) => setItems(d.items)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const importFile = async (file) => {
    if (!file) return;
    setErr(""); setResults(null);
    if (file.size > 8 * 1024 * 1024) return setErr("Plik ma ponad 8 MB.");
    let data;
    try { data = JSON.parse(await file.text()); } catch { return setErr("To nie jest poprawny plik JSON."); }
    setBusy(true);
    try { const d = await rz("import", { data, replace }); setResults(d.results); load(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (open) return <StoryEditor id={open} onClose={() => { setOpen(null); load(); }} />;

  return (
    <div className="space-y-10">
      <div>
        <p className="technical text-[10px] gold-text mb-2">MODUŁ PANELU KLIENTA</p>
        <h2 className="relic-heading text-2xl">ROZDROŻA</h2>
        <p className="text-sm text-foreground/55 mt-3 max-w-3xl leading-relaxed">Interaktywne historie w Moim koncie (zakładka „Rozdroża”, widoczna dla klientów, gdy opublikujesz co najmniej jedną historię). Klienci widzą tylko opublikowane, sprawdzone wersje. Zmiany w szkicu działają po ponownej publikacji. Teksty scen i decyzji zmieniasz ponownym importem pliku — tutaj ustawiasz okładki, obrazy scen i publikację.</p>
      </div>

      <section className="border hairline p-5 md:p-6 space-y-4">
        <h3 className="shop-heading text-xl text-[#F5EFE1]">Import historii z pliku JSON</h3>
        <div className="flex flex-wrap items-center gap-4">
          <label className={`btn-relic cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} WYBIERZ PLIK .JSON
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4 accent-[#C9A24A]" />
            Zastąp szkic historii o tym samym adresie (opublikowana wersja zostaje do ponownej publikacji)
          </label>
        </div>
        <details className="text-sm text-foreground/60">
          <summary className="cursor-pointer hover:text-foreground">Format pliku</summary>
          <p className="mt-3 leading-relaxed">Jedna historia albo lista: <code>[{"{…}"}, {"{…}"}]</code> lub <code>{"{ \"stories\": [ … ] }"}</code>. Typy scen: <code>narrative</code> (przycisk „Dalej” → <code>next_scene_key</code>), <code>decision</code> (wybory z tabeli <code>choices</code> albo w scenie jako <code>"choices": [{"{ \"label\", \"target_scene_key\" }"}]</code>), <code>ending</code> (zakończenie z <code>reflection_question</code>). Treści wgrywają się bez zmian; akapity oddziel pustą linią.</p>
          <pre className="mt-3 p-4 bg-[#0D0D0E] border hairline overflow-x-auto text-xs leading-relaxed">{EXAMPLE}</pre>
        </details>
        {err && <p role="alert" className="text-sm text-[#E8676A]">{err}</p>}
        {results && (
          <ul className="space-y-3">
            {results.map((r, i) => (
              <li key={i} className="border hairline p-4 text-sm">
                <p className="text-[#F5EFE1]">{r.title || "(bez tytułu)"} <span className="text-foreground/45">· {r.slug || "—"}</span></p>
                <p className="technical text-[10px] mt-1 text-foreground/60">{String(r.status).toUpperCase()}</p>
                <p className="mt-2 text-xs text-foreground/55">Sceny: {r.report.stats.scenes} · decyzje: {r.report.stats.choices} · zakończenia osiągalne: {r.report.stats.reachable_endings}/{r.report.stats.endings}</p>
                {r.report.errors.length > 0 && <ul className="mt-2 text-xs text-[#E8676A] list-disc pl-5 space-y-1">{r.report.errors.slice(0, 12).map((e, j) => <li key={j}>{e}</li>)}</ul>}
                {r.report.warnings.length > 0 && <p className="mt-2 text-xs text-[#E8C547]">Ostrzeżenia: {r.report.warnings.length} (szczegóły po otwarciu historii)</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="shop-heading text-xl text-[#F5EFE1] mb-4">Historie</h3>
        {!items ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : !items.length ? (
          <p className="text-sm text-foreground/55">Brak historii. Zaimportuj pierwszą z pliku JSON.</p>
        ) : (
          <ul className="divide-y divide-[#2A2A2D] border hairline">
            {items.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setOpen(s.id)} className="w-full text-left flex items-center gap-4 p-4 hover:bg-white/[0.02]">
                  <div className="w-10 aspect-[2/3] bg-[#141416] shrink-0 overflow-hidden">{s.cover_portrait_url && <img src={s.cover_portrait_url.startsWith("/functions/media") ? `${s.cover_portrait_url}&w=480` : s.cover_portrait_url} alt="" className="w-full h-full object-cover" loading="lazy" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#F5EFE1] truncate">{s.title}</p>
                    <p className="text-xs text-foreground/45 truncate">/{s.slug}</p>
                  </div>
                  {statusBadge(s)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
