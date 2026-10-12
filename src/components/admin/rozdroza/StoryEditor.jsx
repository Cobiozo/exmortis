import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Eye, ChevronDown } from "lucide-react";
import ImageField from "@/components/admin/cms/ImageField";
import { rz, statusBadge, thumb } from "./rzApi";
import GenBlock from "./GenBlock";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2.5 text-sm text-foreground focus:border-[#C9A24A] focus:outline-none";
const lab = "technical text-[10px] text-foreground/55 block mb-1.5";
const TYPE = { narrative: "NARRACJA", decision: "DECYZJA", ending: "ZAKOŃCZENIE" };

function SceneRow({ s, choices, titleOf, onSaved, story }) {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState(s.image_url ? { url: s.image_url, alt: s.alt_text || "" } : null);
  // Po zatwierdzeniu kadru / użyciu poprzedniego obrazu pole pokazuje aktualny stan z serwera.
  useEffect(() => { setImg(s.image_url ? { url: s.image_url, alt: s.alt_text || "" } : null); }, [s.image_url, s.alt_text]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = (img?.url || "") !== (s.image_url || "") || (img?.alt || "") !== (s.alt_text || "");
  const save = async () => {
    setBusy(true); setMsg("");
    try { await rz("update_scene", { id: s.id, image_url: img?.url || "", alt_text: img?.alt || "" }); setMsg("Zapisano."); onSaved(); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const out = s.scene_type === "narrative" ? [["Dalej", s.next_scene_key]] : s.scene_type === "decision" ? choices.map((c) => [c.label, c.target_scene_key]) : [];
  return (
    <li className="border hairline">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full text-left flex items-center gap-3 p-3 hover:bg-white/[0.02]">
        <div className="w-16 aspect-video bg-[#141416] shrink-0 overflow-hidden">{s.image_url && <img src={thumb(s.image_url)} alt="" className="w-full h-full object-cover" loading="lazy" />}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[#F5EFE1] truncate"><span className="technical text-[9px] text-foreground/45 mr-2">{s.scene_key}</span>{s.title || "(bez tytułu)"}</p>
          <p className="text-xs text-foreground/45 truncate">{s.image_candidate_url && <span className="gold-text mr-2">NOWY KADR ·</span>}{TYPE[s.scene_type] || s.scene_type}{out.length ? " → " + out.map(([l, k]) => `${l}: ${k}`).join(" · ") : ""}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-4 border-t hairline grid lg:grid-cols-2 gap-6">
          <div className="space-y-3 min-w-0">
            <p className="text-xs text-foreground/45">Tekst (bez zmian — poprawki przez ponowny import):</p>
            <div className="max-h-64 overflow-y-auto text-sm text-foreground/75 whitespace-pre-line leading-relaxed border hairline p-3">{s.body || "—"}</div>
            {out.length > 0 && (
              <ul className="text-xs space-y-1">
                {out.map(([l, k], i) => <li key={i} className={titleOf(k) === null ? "text-[#E8676A]" : "text-foreground/60"}>„{l}” → {k} {titleOf(k) === null ? "(SCENA NIE ISTNIEJE)" : `· ${titleOf(k) || "bez tytułu"}`}</li>)}
              </ul>
            )}
            {s.reflection_question && <p className="text-xs text-foreground/60">Pytanie refleksyjne: <em>{s.reflection_question}</em></p>}
          </div>
          <div className="space-y-3 min-w-0">
            <p className={lab}>OBRAZ SCENY (16:9)</p>
            <ImageField value={img} onChange={setImg} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={save} disabled={!dirty || busy} className="btn-relic !px-4 !py-2 text-[10px] disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} ZAPISZ OBRAZ</button>
              {msg && <span className="text-xs text-foreground/60">{msg}</span>}
            </div>
            <GenBlock kind="scene" id={s.id} url={s.image_url} candidate={s.image_candidate_url} prompt={s.image_prompt} story={story}
              allowPrevious={s.sort_order > 0} onSavePrompt={(v) => rz("update_scene", { id: s.id, image_prompt: v })} onChanged={onSaved} />
          </div>
        </div>
      )}
    </li>
  );
}

// Jedna historia: dane do biblioteki, okładki, obrazy scen, raport połączeń, podgląd i publikacja.
export default function StoryEditor({ id, onClose }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const load = () => rz("get", { id }).then((x) => {
    setD(x);
    setF({ title: x.story.title, slug: x.story.slug, summary: x.story.summary, category: x.story.category, estimated_minutes: x.story.estimated_minutes || "",
      content_warning: x.story.content_warning, start_scene_key: x.story.start_scene_key || "", sort_order: x.story.sort_order ?? 0,
      cover_portrait_url: x.story.cover_portrait_url, cover_landscape_url: x.story.cover_landscape_url,
      reading_time: x.story.reading_time || "", visual_notes: x.story.visual_notes || "", image_style: x.story.image_style || "" });
  }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  const run = async (action, extra = {}, okMsg = "") => {
    setBusy(action); setMsg(""); setErr("");
    try { await rz(action, { id, ...extra }); if (okMsg) setMsg(okMsg); await load(); return true; }
    catch (e) { setErr(e.message); if (e.report) setD((x) => ({ ...x, report: e.report })); return false; }
    finally { setBusy(""); }
  };

  if (err && !d) return <p className="text-sm text-[#E8676A]">{err} <button onClick={onClose} className="underline ml-2">Wróć</button></p>;
  if (!d || !f) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const keys = new Map(d.scenes.map((s) => [s.scene_key, s.title || ""]));
  const titleOf = (k) => (keys.has(k) ? keys.get(k) : null);
  const byScene = (k) => d.choices.filter((c) => c.source_scene_key === k).sort((a, b) => a.sort_order - b.sort_order);
  const r = d.report;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={onClose} className="technical text-[10px] text-foreground/55 hover:text-foreground inline-flex items-center gap-2"><ArrowLeft className="h-3.5 w-3.5" /> WSZYSTKIE HISTORIE</button>
        {statusBadge(d.story)}
      </div>
      <h2 className="shop-heading text-3xl text-[#F5EFE1]">{d.story.title}</h2>

      <section className={`border p-5 space-y-3 ${r.errors.length ? "border-[#BC1E22]/60" : "hairline"}`}>
        <h3 className="technical text-[10px] gold-text">SPRAWDZENIE POŁĄCZEŃ</h3>
        <p className="text-sm text-foreground/70">Sceny: {r.stats.scenes} · decyzje: {r.stats.decisions} · zakończenia osiągalne: {r.stats.reachable_endings} z {r.stats.endings}</p>
        {r.errors.length ? <ul className="text-sm text-[#E8676A] list-disc pl-5 space-y-1">{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          : <p className="text-sm text-[#9FD3A0]">Bez błędów — historię można opublikować.</p>}
        {r.warnings.length > 0 && (
          <details className="text-sm text-[#E8C547]"><summary className="cursor-pointer">Ostrzeżenia ({r.warnings.length})</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">{r.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <a href={`/konto/rozdroza/podglad?id=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" className="btn-ghost !px-4 !py-2 text-[10px]"><Eye className="h-4 w-4" /> PODGLĄD SZKICU</a>
          <button type="button" onClick={() => run("publish", {}, "Opublikowano — klienci widzą nową wersję w ciągu minuty.")} disabled={!!busy || r.errors.length > 0} className="btn-relic !px-4 !py-2 text-[10px] disabled:opacity-40">
            {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}{d.story.status === "published" ? "OPUBLIKUJ PONOWNIE" : "OPUBLIKUJ"}
          </button>
          {d.story.status === "published" && <button type="button" onClick={() => run("unpublish", {}, "Wycofano — historia zniknie z biblioteki w ciągu minuty.")} disabled={!!busy} className="btn-ghost !px-4 !py-2 text-[10px]">WYCOFAJ PUBLIKACJĘ</button>}
          {d.story.status !== "published" && (confirmDel
            ? <button type="button" onClick={async () => { if (await run("delete")) onClose(); }} className="btn-blood !px-4 !py-2 text-[10px]">NA PEWNO USUŃ SZKIC</button>
            : <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-foreground/45 underline hover:text-[#E8676A]">usuń szkic</button>)}
        </div>
        {msg && <p className="text-sm text-[#9FD3A0]" role="status">{msg}</p>}
        {err && <p className="text-sm text-[#E8676A]" role="alert">{err}</p>}
      </section>

      <section className="space-y-5">
        <h3 className="shop-heading text-xl text-[#F5EFE1]">Dane w bibliotece</h3>
        <div className="grid md:grid-cols-2 gap-5">
          <label className="block"><span className={lab}>TYTUŁ</span><input className={inp} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
          <label className="block"><span className={lab}>ADRES (/konto/rozdroza/…)</span><input className={inp} value={f.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          <label className="block md:col-span-2"><span className={lab}>KRÓTKI OPIS</span><textarea rows={3} className={inp} value={f.summary} onChange={(e) => set("summary", e.target.value)} /></label>
          <label className="block"><span className={lab}>KATEGORIA</span>
            <select className={inp} value={f.category || ""} onChange={(e) => set("category", e.target.value)}>
              <option value="">—</option><option value="mentalna">Śmierć mentalna</option><option value="duchowa">Śmierć duchowa</option><option value="zyciowa">Śmierć życiowa</option>
            </select></label>
          <label className="block"><span className={lab}>CZAS CZYTANIA (MIN, LICZBA)</span><input type="number" min="0" className={inp} value={f.estimated_minutes} onChange={(e) => set("estimated_minutes", e.target.value)} /></label>
          <label className="block"><span className={lab}>CZAS CZYTANIA — NAPIS (NP. 12–16 MIN)</span><input className={inp} value={f.reading_time} onChange={(e) => set("reading_time", e.target.value)} /></label>
          <label className="block"><span className={lab}>SCENA STARTOWA</span>
            <select className={inp} value={f.start_scene_key} onChange={(e) => set("start_scene_key", e.target.value)}>
              {d.scenes.map((s) => <option key={s.id} value={s.scene_key}>{s.scene_key} — {s.title || "bez tytułu"}</option>)}
            </select></label>
          <label className="block"><span className={lab}>KOLEJNOŚĆ W BIBLIOTECE</span><input type="number" className={inp} value={f.sort_order} onChange={(e) => set("sort_order", e.target.value)} /></label>
          <label className="block md:col-span-2"><span className={lab}>OSTRZEŻENIE O TRUDNYCH TREŚCIACH (OPCJONALNIE)</span><textarea rows={2} className={inp} value={f.content_warning} onChange={(e) => set("content_warning", e.target.value)} /></label>
          <div className="space-y-4 min-w-0"><p className={lab}>OKŁADKA PIONOWA 2:3 (BIBLIOTEKA)</p><ImageField noAlt value={f.cover_portrait_url ? { url: f.cover_portrait_url } : null} onChange={(v) => set("cover_portrait_url", v?.url || "")} />
            <GenBlock kind="cover_portrait" id={id} url={d.story.cover_portrait_url} candidate={d.story.cover_portrait_candidate} prompt={d.story.cover_portrait_prompt} story={d.story}
              onSavePrompt={(v) => rz("update_story", { id, fields: { cover_portrait_prompt: v } })} onChanged={load} /></div>
          <div className="space-y-4 min-w-0"><p className={lab}>OKŁADKA POZIOMA 16:9 (KARTA HISTORII)</p><ImageField noAlt value={f.cover_landscape_url ? { url: f.cover_landscape_url } : null} onChange={(v) => set("cover_landscape_url", v?.url || "")} />
            <GenBlock kind="cover_landscape" id={id} url={d.story.cover_landscape_url} candidate={d.story.cover_landscape_candidate} prompt={d.story.cover_landscape_prompt} story={d.story}
              onSavePrompt={(v) => rz("update_story", { id, fields: { cover_landscape_prompt: v } })} onChanged={load} /></div>
          <details className="md:col-span-2 border hairline p-4">
            <summary className="cursor-pointer technical text-[10px] text-foreground/60">POSTACIE I STYL ZDJĘĆ (DO GENEROWANIA I KOPIOWANIA PROMPTÓW)</summary>
            <div className="grid gap-4 mt-4">
              <label className="block"><span className={lab}>CIĄGŁOŚĆ POSTACI</span><textarea rows={3} className={inp} value={f.visual_notes} onChange={(e) => set("visual_notes", e.target.value)} /></label>
              <label className="block"><span className={lab}>WSPÓLNY STYL (PUSTE = DOMYŚLNY STYL EXMORTIS)</span><textarea rows={3} className={inp} value={f.image_style} onChange={(e) => set("image_style", e.target.value)} /></label>
            </div>
          </details>
        </div>
        <button type="button" onClick={() => run("update_story", { fields: { ...f, estimated_minutes: f.estimated_minutes === "" ? 0 : Number(f.estimated_minutes) } }, "Zapisano. Klienci zobaczą zmiany po ponownej publikacji.")} disabled={!!busy} className="btn-relic">
          {busy === "update_story" && <Loader2 className="h-4 w-4 animate-spin" />} ZAPISZ DANE
        </button>
      </section>

      <section className="space-y-4">
        <h3 className="shop-heading text-xl text-[#F5EFE1]">Sceny ({d.scenes.length})</h3>
        <ul className="space-y-2">
          {d.scenes.map((s) => <SceneRow key={s.id} s={s} story={d.story} choices={byScene(s.scene_key)} titleOf={titleOf} onSaved={load} />)}
        </ul>
      </section>
    </div>
  );
}
