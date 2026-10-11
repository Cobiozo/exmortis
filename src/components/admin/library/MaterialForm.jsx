import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, inputCls, KINDS, KIND_LABEL } from "./libApi";
import LibModal from "./LibModal";
import MaterialUpload from "./MaterialUpload";
import RichLite from "./RichLite";

// Podgląd adresu wideo po zatwierdzeniu (YouTube i Vimeo, także link prywatny).
function videoEmbed(url) {
  const u = String(url || "");
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([A-Za-z0-9]+))?/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}${vm[2] ? `?h=${vm[2]}` : ""}`;
  return null;
}

export default function MaterialForm({ open, onClose, item, onDone, onRefresh }) {
  const [f, setF] = useState(() => ({
    id: item?.id || null,
    kind: item?.kind || "PDF",
    title: item?.title || "",
    description: item?.description || "",
    stage: item?.stage || "",
    tags: (item?.tags || []).join(", "),
    allow_download: item?.allow_download === true,
    external_url: item?.external_url || "",
    video_source: item?.kind === "WIDEO" ? (item.video_provider === "plik" ? "plik" : item.video_provider === "serwer" ? "serwer" : "link") : "link",
    server_url: item?.server_url || "",
    body_html: item?.body_html || "",
    duration_s: item?.duration_s ?? "",
    pages: item?.pages ?? "",
    file_name: item?.file_name || "",
    prev_file_name: item?.prev_file_name || "",
  }));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const isFile = f.kind === "PDF" || f.kind === "AUDIO" || (f.kind === "WIDEO" && f.video_source === "plik");
  const embed = f.kind === "WIDEO" && f.video_source === "link" ? videoEmbed(f.external_url) : null;
  const VIDEO_SOURCES = [
    ["link", "Link: YouTube / Vimeo / Bunny"],
    ["plik", "Plik wideo"],
    ["serwer", "Adres pliku z mojego serwera"],
  ];

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      await lib("material_save", {
        id: f.id, kind: f.kind, title: f.title, description: f.description, stage: f.stage,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
        allow_download: f.allow_download, external_url: f.external_url, body_html: f.body_html,
        video_source: f.kind === "WIDEO" ? f.video_source : null,
        server_url: f.kind === "WIDEO" && f.video_source === "serwer" ? f.server_url : null,
        duration_s: f.duration_s === "" ? null : Number(f.duration_s),
        pages: f.pages === "" ? null : Number(f.pages),
      });
      onDone();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const restore = async () => {
    setErr(""); setBusy(true);
    try { await lib("material_restore_prev", { id: f.id }); onDone(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <LibModal
      open={open} onClose={onClose} wide title={item ? "Edytuj materiał" : "Nowy materiał"}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>ANULUJ</button>
          <button className="btn-relic" onClick={save} disabled={busy || (isFile && !f.id)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ"}
          </button>
        </>
      }
    >
      {!item && !f.id && (
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">RODZAJ</label>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => set("kind", k)}
                className={`px-3 py-2 technical text-[10px] border hairline ${f.kind === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {isFile && (
        <>
          <MaterialUpload
            kind={f.kind}
            id={f.id}
            onDone={(r, fn) => {
              set("id", r.id);
              set("file_name", fn);
              set("title", f.title || fn.replace(/\.[a-z0-9]{1,8}$/i, ""));
              if (item) onDone(); else onRefresh?.();
            }}
          />
          {f.file_name && <p className="text-xs text-foreground/50">Plik: {f.file_name}</p>}
          {f.prev_file_name && (
            <div className="flex items-center justify-between gap-3 border hairline px-3 py-2">
              <p className="text-xs text-foreground/50">Poprzednia wersja: {f.prev_file_name}</p>
              <button className="btn-ghost !px-3 !py-2" onClick={restore} disabled={busy}>PRZYWRÓĆ</button>
            </div>
          )}
        </>
      )}

      {f.kind === "WIDEO" && (
        <div className="space-y-3">
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">ŹRÓDŁO WIDEO</label>
            <div className="flex flex-wrap gap-2">
              {VIDEO_SOURCES.map(([k, l]) => (
                <button key={k} type="button" onClick={() => set("video_source", k)}
                  className={`px-3 py-2 technical text-[10px] border hairline ${f.video_source === k ? "bg-[#C9A24A] text-[#0A0A0B]" : "text-foreground/60 hover:gold-text"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {f.video_source === "link" && (
            <div>
              <input value={f.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" className={inputCls} />
              <p className="text-xs text-foreground/45 mt-2">YouTube, Vimeo (także link prywatny) lub Bunny.</p>
              {embed && <div className="mt-3 aspect-video border hairline"><iframe src={embed} title="Podgląd" className="h-full w-full" allowFullScreen /></div>}
            </div>
          )}

          {f.video_source === "plik" && (
            <div className="space-y-2">
              {f.id && f.file_name && <p className="text-xs text-foreground/50">Plik: {f.file_name}</p>}
              {f.id && f.prev_file_name && (
                <div className="flex items-center justify-between gap-3 border hairline px-3 py-2">
                  <p className="text-xs text-foreground/50">Poprzednia wersja: {f.prev_file_name}</p>
                  <button className="btn-ghost !px-3 !py-2" onClick={restore} disabled={busy}>PRZYWRÓĆ</button>
                </div>
              )}
            </div>
          )}

          {f.video_source === "serwer" && (
            <div>
              <input value={f.server_url} onChange={(e) => set("server_url", e.target.value)} placeholder="https://moj-serwer.pl/plik.mp4" className={inputCls} />
              <p className="text-xs text-foreground/45 mt-2">
                Wyłącznie https i domena wpisana w Ustawieniach → Biblioteka i wiadomości. Dozwolone rozszerzenia: .mp4, .m4v, .webm.
              </p>
              <p className="text-xs text-foreground/45 mt-1">
                Plik na Twoim serwerze jest dostępny dla każdego, kto zna adres — chroń go po stronie serwera, jeśli to ważne.
              </p>
            </div>
          )}
        </div>
      )}

      {f.kind === "LINK" && (
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">ADRES</label>
          <input value={f.external_url} onChange={(e) => set("external_url", e.target.value)} placeholder="https://…" className={inputCls} />
        </div>
      )}

      {f.kind === "TEKST" && (
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">TREŚĆ</label>
          <RichLite value={f.body_html} onChange={(v) => set("body_html", v)} />
        </div>
      )}

      {(!isFile || f.id) && (
        <>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">TYTUŁ</label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">OPIS</label>
            <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-2">ETAP</label>
              <input value={f.stage} onChange={(e) => set("stage", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="technical text-[10px] text-foreground/50 block mb-2">TAGI (PO PRZECINKU)</label>
              <input value={f.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} />
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={f.allow_download} onChange={(e) => set("allow_download", e.target.checked)} className="mt-1 accent-[#C9A24A]" />
            <span>
              <span className="text-sm block">Pobieranie dozwolone</span>
              <span className="text-xs text-foreground/45">
                Ukrywa przycisk pobierania i menu odtwarzacza, nie blokuje zapisania pliku.
              </span>
            </span>
          </label>
        </>
      )}

      {err && <p className="text-sm blood-text">{err}</p>}
    </LibModal>
  );
}