import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { upload, compressImage, inspectVideo } from "./bgMedia";
import FocusPicker from "./FocusPicker";

const inp = "w-full bg-transparent border hairline px-3 py-2 text-sm";
const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];

// Pola zależne od typu tła: kolor, gradient, zdjęcia (z kompresją), wideo (z kontrolą i posterem).
export default function BgMediaFields({ f, set }) {
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState([]);

  const pickImage = async (key, file, maxW, kb, minW) => {
    setBusy(key); setNotes([]);
    try {
      const r = await compressImage(file, maxW, kb);
      const n = [];
      if (r.width < minW) n.push(`Obraz ma ${r.width}px szerokości — zalecane min. ${minW}px.`);
      const url = await upload(r.file);
      set({ [key]: url });
      setNotes(n);
    } catch (x) {
      setNotes([String((x && x.message) || x)]);
    } finally {
      setBusy("");
    }
  };

  const pickVideo = async (key, file) => {
    if (file.size > 15 * 1024 * 1024) { setNotes(["Plik przekracza 15 MB — wybierz mniejszy."]); return; }
    setBusy(key); setNotes([]);
    try {
      const info = await inspectVideo(file);
      const n = [];
      if (file.size > 8 * 1024 * 1024) n.push("Plik ma ponad 8 MB — zalecane do 8 MB.");
      if (info.duration < 10 || info.duration > 60) n.push(`Długość ${info.duration} s — zalecane 10–60 s.`);
      if (key === "wideo_mobile" && info.height > 720 && info.width > 720) n.push("Wersja na telefon powinna mieć max 720p.");
      if (info.audio) n.push("Plik ma ścieżkę dźwiękową — na stronie zawsze gra wyciszony.");
      const patch = { [key]: await upload(file) };
      if (key === "wideo_mp4") Object.assign(patch, { dlugosc_s: info.duration, ma_dzwiek: info.audio, poster: f.poster || (await upload(info.poster)) });
      set(patch);
      setNotes(n);
    } catch (x) {
      setNotes([String((x && x.message) || x)]);
    } finally {
      setBusy("");
    }
  };

  const fileRow = (label, key, accept, onFile) => (
    <label className="block">
      <span className="text-xs text-foreground/50">{label}</span>
      <div className="flex items-center gap-3 mt-1">
        <input type="file" accept={accept} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} className="text-xs" />
        {busy === key ? <Loader2 className="h-4 w-4 animate-spin gold-text" /> : f[key] && <span className="text-xs gold-text">✓ dodany</span>}
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      {f.typ === "kolor" && (
        <div className="flex gap-3 items-center">
          <input type="color" value={f.kolor || "#0A0A0A"} onChange={(e) => set({ kolor: e.target.value })} />
          <input className={inp} value={f.kolor || ""} onChange={(e) => set({ kolor: e.target.value })} />
        </div>
      )}
      {f.typ === "gradient" && (
        <div className="flex flex-wrap gap-3 items-center">
          {[0, 1, 2].map((i) => (
            <input key={i} type="color" value={(f.kolory || [])[i] || "#0A0A0A"}
              onChange={(e) => { const k = [...(f.kolory || ["#0A0A0A", "#1A1410"])]; k[i] = e.target.value; set({ kolory: k }); }} />
          ))}
          <button type="button" className="text-xs text-foreground/50" onClick={() => set({ kolory: (f.kolory || []).slice(0, 2) })}>tylko 2 kolory</button>
          <select className={`${inp} w-auto`} value={f.kierunek ?? 180} onChange={(e) => set({ kierunek: Number(e.target.value) })}>
            {DIRS.map((d) => <option key={d} value={d} className="bg-[#0A0A0B]">{d}°</option>)}
          </select>
        </div>
      )}
      {f.typ === "zdjecie" && (
        <>
          {fileRow("Wersja szeroka (min. 2560px, ok. 400 KB)", "zdjecie_szerokie", "image/*", (x) => pickImage("zdjecie_szerokie", x, 2560, 400, 2560))}
          {fileRow("Wersja pionowa 1080×1920 (ok. 300 KB)", "zdjecie_pionowe", "image/*", (x) => pickImage("zdjecie_pionowe", x, 1080, 300, 1080))}
          {f.zdjecie_szerokie && <FocusPicker src={f.zdjecie_szerokie} x={f.fokus_x} y={f.fokus_y} onChange={(x, y) => set({ fokus_x: x, fokus_y: y })} />}
        </>
      )}
      {f.typ === "wideo" && (
        <>
          {fileRow("Wideo MP4 H.264 (max 15 MB)", "wideo_mp4", "video/mp4", (x) => pickVideo("wideo_mp4", x))}
          {fileRow("Opcjonalnie WebM", "wideo_webm", "video/webm", (x) => pickVideo("wideo_webm", x))}
          {fileRow("Wersja na telefon ≤720p (MP4)", "wideo_mobile", "video/mp4", (x) => pickVideo("wideo_mobile", x))}
          {fileRow("Poster (tworzony automatycznie, można podmienić)", "poster", "image/*", (x) => pickImage("poster", x, 1920, 300, 0))}
          {f.dlugosc_s ? <p className="text-xs text-foreground/50">Długość: {f.dlugosc_s} s · zapętlone · zawsze bez dźwięku</p> : null}
        </>
      )}
      {notes.map((n) => <p key={n} className="text-xs text-[#E2C170]">{n}</p>)}
    </div>
  );
}