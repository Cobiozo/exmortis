import React, { useState } from "react";
import { FileText, Headphones, Film, Layers, Download, BookOpen, Loader2, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import AccessLine from "./AccessLine";
import { TYPE_LABEL } from "./accountUtils";

const ICONS = { pdf: FileText, audio: Headphones, wideo: Film, kurs: Layers };
const ico = "h-4 w-4";

// Kafelek w „Moich produktach”.
export default function ProductTile({ p }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [audio, setAudio] = useState(null);
  const Icon = ICONS[p.type] || FileText;

  const getUrl = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await base44.functions.invoke("myAccount", { action: "file", access_id: p.access_id });
      return r.data.url;
    } catch {
      setErr("Plik nie chce się wczytać. Spróbuj jeszcze raz za chwilę.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const open = async () => { const u = await getUrl(); if (u) window.open(u, "_blank", "noopener,noreferrer"); };

  return (
    <div className={`border hairline flex flex-col ${p.active ? "" : "opacity-50"}`}>
      <div className="aspect-[4/3] bg-[#0F0F10] relative">
        {p.cover ? <Image src={p.cover} alt="" className="absolute inset-0 w-full h-full" /> : (
          <div className="absolute inset-0 flex items-center justify-center"><Icon className="h-10 w-10 gold-text" strokeWidth={1} /></div>
        )}
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="flex items-center gap-2 technical text-[9px] gold-text"><Icon className="h-3.5 w-3.5" strokeWidth={1.25} /> {TYPE_LABEL[p.type]}</p>
        <h3 className="shop-heading text-xl text-[#F5EFE1] leading-tight">{p.name}</h3>
        <AccessLine p={p} />
        <div className="mt-auto pt-3 space-y-3">
          {!p.active ? null : !p.has_file && (p.type === "pdf" || p.type === "audio") ? (
            <p className="text-xs text-foreground/40">Materiał jest przygotowywany. Dam znać mailem.</p>
          ) : p.type === "pdf" ? (
            <div className="flex flex-wrap gap-3">
              <button onClick={open} disabled={busy} className="btn-relic !px-4 !py-2.5">{busy ? <Loader2 className={`${ico} animate-spin`} /> : <Download className={ico} strokeWidth={1.25} />} POBIERZ</button>
              <button onClick={open} disabled={busy} className="btn-ghost !px-4 !py-2.5"><BookOpen className={ico} strokeWidth={1.25} /> CZYTAJ W PRZEGLĄDARCE</button>
            </div>
          ) : p.type === "audio" ? (
            audio ? <audio src={audio} controls autoPlay controlsList="nodownload" className="w-full" /> : (
              <button onClick={async () => setAudio(await getUrl())} disabled={busy} className="btn-relic !px-4 !py-2.5">{busy ? <Loader2 className={`${ico} animate-spin`} /> : <Play className={ico} strokeWidth={1.25} />} SŁUCHAJ</button>
            )
          ) : (
            <p className="text-xs text-foreground/40">Odtwarzacz kursów pojawi się w kolejnym etapie.</p>
          )}
          {err && <p className="text-xs text-[#E8C547]">{err}</p>}
        </div>
      </div>
    </div>
  );
}