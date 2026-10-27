import React, { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { lib, KIND_LABEL } from "./libApi";
import LibModal from "./LibModal";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

const EMBED = {
  youtube: (id) => `https://www.youtube.com/embed/${id}`,
  vimeo: (id) => `https://player.vimeo.com/video/${id}`,
  bunny: (id) => `https://iframe.mediadelivery.net/embed/${id}`,
};

// Podgląd materiału w panelu — dokładnie ten plik, który dostanie klient.
export default function MaterialPreview({ open, item, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const id = item && item.id;

  useEffect(() => {
    if (!open || !id) return;
    setD(null); setErr("");
    lib("material_preview", { id }).then(setD).catch((e) => setErr(e.message));
  }, [open, id]);

  const kind = d ? d.kind : item ? item.kind : "";
  const embed = d && d.video_provider && d.video_id && EMBED[d.video_provider] ? EMBED[d.video_provider](d.video_id) : null;

  return (
    <LibModal open={open} onClose={onClose} title={item ? item.title : "Podgląd"} wide>
      <p className="technical text-[10px] gold-text">{KIND_LABEL[kind] || kind}</p>

      {!d && !err && (
        <p className="flex items-center gap-2 text-sm text-foreground/60"><Loader2 className="h-4 w-4 animate-spin" /> Wczytuję podgląd…</p>
      )}
      {err && <p className="text-sm blood-text">{err}</p>}
      {d && d.problem && <p className="text-sm blood-text">{d.problem}</p>}

      {d && d.kind === "PDF" && d.url && (
        <div className="space-y-3">
          <iframe src={d.url} title={item ? item.title : "PDF"} className="h-[60vh] w-full bg-white" />
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-3 !py-2">
            <ExternalLink className="h-4 w-4" /> OTWÓRZ W NOWEJ KARCIE
          </a>
        </div>
      )}

      {d && d.kind === "AUDIO" && d.url && <audio controls src={d.url} className="w-full" />}

      {d && d.kind === "WIDEO" && d.url && <video controls src={d.url} className="max-h-[60vh] w-full bg-black" />}
      {d && d.kind === "WIDEO" && !d.url && embed && (
        <iframe src={embed} title="Wideo" className="h-[60vh] w-full" allowFullScreen />
      )}

      {d && d.kind === "TEKST" && (
        <div className="rich-content text-sm text-foreground/85" dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.text || "") }} />
      )}

      {d && d.kind === "LINK" && d.external && (
        <a href={d.external} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-3 !py-2">
          <ExternalLink className="h-4 w-4" /> OTWÓRZ ODNOSNIK
        </a>
      )}

      {d && !d.url && !embed && !d.problem && d.kind !== "TEKST" && d.kind !== "LINK" && (
        <p className="text-sm text-foreground/50">Ten materiał nie ma pliku do pokazania.</p>
      )}
    </LibModal>
  );
}