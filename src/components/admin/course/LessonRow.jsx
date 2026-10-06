import React, { useState } from "react";
import { Upload, Loader2, Trash2, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";

export default function LessonRow({ lesson, onChange }) {
  const [f, setF] = useState(lesson);
  const [busy, setBusy] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const save = async (extra = {}) => {
    setBusy("save");
    await base44.entities.CourseLesson.update(lesson.id, {
      module: f.module || "", title: f.title, order: Number(f.order) || 0, description: f.description || "",
      duration_min: f.duration_min ? Number(f.duration_min) : null, published: !!f.published, ...extra,
    });
    setBusy(""); setMsg("Zapisano"); onChange();
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("up"); setMsg("");
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      set("video_name", file.name);
      await save({ video_uri: file_uri, video_name: file.name });
    } catch {
      setBusy(""); setMsg("Nie udało się wgrać wideo. Spróbuj mniejszego pliku (MP4).");
    }
  };

  return (
    <div className="border hairline p-4 space-y-3">
      <div className="grid md:grid-cols-[70px_1fr_1fr_90px] gap-3">
        <input className={inp} type="number" value={f.order ?? 0} onChange={(e) => set("order", e.target.value)} title="Kolejność" />
        <input className={inp} value={f.module || ""} onChange={(e) => set("module", e.target.value)} placeholder="Moduł (opcjonalnie)" />
        <input className={inp} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Tytuł lekcji" />
        <input className={inp} type="number" value={f.duration_min || ""} onChange={(e) => set("duration_min", e.target.value)} placeholder="min" />
      </div>
      <textarea className={inp} rows={2} value={f.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Opis / notatki pod wideo" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost cursor-pointer !px-3 !py-2 text-[10px]">
          {busy === "up" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {f.video_uri ? "ZMIEŃ WIDEO" : "WGRAJ WIDEO"}
          <input type="file" accept="video/*" className="hidden" onChange={upload} disabled={!!busy} />
        </label>
        <span className="text-xs text-foreground/50">{f.video_name || "brak wideo"}</span>
        <label className="flex items-center gap-2 text-xs text-foreground/60">
          <input type="checkbox" checked={!!f.published} onChange={(e) => set("published", e.target.checked)} className="accent-[#C9A24A]" /> Widoczna dla klientów
        </label>
        <button type="button" onClick={() => save()} disabled={!!busy} className="btn-relic !px-3 !py-2 text-[10px] ml-auto">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ZAPISZ
        </button>
        {confirmDel ? (
          <button type="button" onClick={async () => { await base44.entities.CourseLesson.delete(lesson.id); onChange(); }} className="btn-blood !px-3 !py-2 text-[10px]">NA PEWNO USUŃ</button>
        ) : (
          <button type="button" onClick={() => setConfirmDel(true)} className="btn-ghost !px-3 !py-2"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
      {msg && <p className="text-xs gold-text">{msg}</p>}
    </div>
  );
}