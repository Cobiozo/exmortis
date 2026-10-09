import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

const FORMATS = [["audio", "Audio"], ["audio_obraz", "Audio + obraz"], ["wideo", "Wideo"]];
const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";

// Odczyt długości pliku w przeglądarce.
const duration = (file, video) => new Promise((res) => {
  const el = document.createElement(video ? "video" : "audio");
  el.preload = "metadata"; el.onloadedmetadata = () => { res(Math.round(el.duration || 0)); URL.revokeObjectURL(el.src); }; el.onerror = () => res(0);
  el.src = URL.createObjectURL(file);
});

// Wgranie pliku nagrania do prywatnego magazynu, rozpoznanie formatu i długości.
export default function RecordingUpload({ r, setR }) {
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState("");
  const pick = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setWarn("");
    const video = file.type.startsWith("video/");
    const [{ file_uri }, dl] = await Promise.all([base44.integrations.Core.UploadPrivateFile({ file }), duration(file, video)]);
    setR((x) => ({ ...x, plik_uri: file_uri, plik_mime: file.type, dlugosc_s: dl, format: video ? "wideo" : x.format === "wideo" ? "audio" : x.format || "audio" }));
    if (dl > 900) setWarn("Nagranie jest dłuższe niż 15 minut.");
    setBusy(false);
  };
  return (
    <div className="border hairline p-5 space-y-4">
      <p className="technical text-[10px] gold-text">PLIK NAGRANIA</p>
      <div className="flex flex-wrap gap-2">{FORMATS.map(([v, l]) => <button key={v} type="button" onClick={() => setR({ ...r, format: v })} className={`technical text-[10px] px-3 py-2 border ${r.format === v ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55"}`}>{l}</button>)}</div>
      <p className="text-xs text-foreground/50">Jeśli Twoje wideo to tylko nieruchoma okładka, wybierz AUDIO + OBRAZ — plik będzie ok. 10× lżejszy i szybciej się załaduje.</p>
      <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,video/mp4,video/quicktime,video/webm" onChange={pick} disabled={busy} className="text-sm" />
      {busy && <p className="text-sm gold-text">Wgrywam…</p>}
      {r.plik_uri && !busy && <p className="text-sm text-foreground/60">Plik zapisany · {Math.floor((r.dlugosc_s || 0) / 60)}:{String((r.dlugosc_s || 0) % 60).padStart(2, "0")}</p>}
      {warn && <p className="text-sm blood-text">{warn}</p>}
      {r.format !== "audio" && <label className="block"><span className="block technical text-[10px] text-foreground/60 mb-2">{r.format === "wideo" ? "Miniatura (adres z Biblioteki mediów)" : "Obraz nad odtwarzaczem (adres z Biblioteki mediów)"}</span>
        <input value={r.obraz || ""} onChange={(e) => setR({ ...r, obraz: e.target.value })} className={inp} /></label>}
    </div>
  );
}