import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload } from "lucide-react";
import { lib, LIMITS, mb1 } from "./libApi";

const ALLOWED = { PDF: ["pdf"], AUDIO: ["mp3", "m4a"] };

// Wgranie pliku do magazynu prywatnego (bez publicznego adresu).
// Klucz pliku nigdy nie trafia do stanu interfejsu — leci prosto do serwera.
export default function MaterialUpload({ kind, id, onDone }) {
  const lim = LIMITS[kind];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const ref = useRef(null);

  const pick = async (file) => {
    if (!file) return;
    setErr(""); setName(file.name);
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED[kind].includes(ext)) { setErr(`Dozwolone rozszerzenia: ${lim.ext}.`); return; }
    if (file.size > lim.mb * 1048576) { setErr(`Plik ma ${mb1(file.size)} MB, a limit to ${lim.mb} MB.`); return; }
    setBusy(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const r = id
        ? await lib("material_replace", { id, file_uri, file_name: file.name, file_size: file.size })
        : await lib("material_register", { kind, file_uri, file_name: file.name, file_size: file.size });
      onDone(r, file.name);
    } catch (e) { setErr(e.message); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };

  return (
    <div className="border hairline p-4 space-y-3">
      <p className="text-xs text-foreground/50">
        {id ? "Zamiana pliku tworzy nową wersję — przydziały zostają bez zmian." : `Wgranie pliku. Limit: ${lim.ext} do ${lim.mb} MB.`}
      </p>
      <input ref={ref} type="file" accept={kind === "PDF" ? ".pdf,application/pdf" : ".mp3,.m4a,audio/*"}
        onChange={(e) => pick(e.target.files?.[0])} disabled={busy}
        className="block w-full text-xs text-foreground/70 file:mr-3 file:px-4 file:py-2 file:border file:border-[#3D3D3F] file:bg-transparent file:text-[#C9A24A] file:technical file:text-[10px]" />
      {busy && (
        <div className="space-y-1">
          <div className="h-1.5 w-full bg-[#1A1A1B] border hairline overflow-hidden">
            <div className="h-full w-1/3 bg-[#C9A24A] animate-pulse" />
          </div>
          <p className="text-xs text-foreground/50 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Wgrywam {name}…</p>
        </div>
      )}
      {err && <p className="text-xs blood-text">{err}</p>}
      {!busy && !err && name && <p className="text-xs gold-text flex items-center gap-2"><Upload className="h-3 w-3" /> Gotowe.</p>}
    </div>
  );
}