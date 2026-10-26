import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ImagePlus, Eye, Save, RotateCcw, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SITE_URL } from "@/config/site";

// Wzór biletu: obraz (np. z Canvy) + pola przeciągane myszą/palcem: imię i nazwisko, kod QR, numer biletu.
// Położenie zapisywane w ułamkach strony — PDF na serwerze rysuje dokładnie w tych miejscach.
const DEFAULT = {
  name: { x: 0.36, y: 0.62, size: 0.042, color: "#F5EFE1", font: "cinzel", align: "center", upper: false },
  qr: { x: 0.74, y: 0.22, size: 0.2, dark: "#0A0A0B", light: "#FFFFFF" },
  code: { x: 0.84, y: 0.84, size: 0.024, color: "#C9A24A", font: "mono", align: "center", upper: false },
};
const FONTS = [["cinzel", "Cinzel", "'Cinzel', serif"], ["garamond", "EB Garamond", "'EB Garamond', serif"], ["inter", "Inter", "'Inter', sans-serif"], ["mono", "Space Mono", "'Space Mono', monospace"]];
const fontCss = (k) => FONTS.find((f) => f[0] === k)?.[2] || "serif";
const LABEL = { name: "Imię i nazwisko", qr: "Kod QR", code: "Numer biletu" };
const SAMPLE = { name: "Anna Kowalska-Wiśniewska", code: "KRT-4821" };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

async function toJpeg(file) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  const scale = Math.min(1, 2480 / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.9));
  URL.revokeObjectURL(url);
  return { file: new File([blob], "wzor-biletu.jpg", { type: "image/jpeg" }), w, h };
}

export default function TemplateEditor({ event, reload }) {
  const saved = event.ticket_template;
  const [t, setT] = useState(() => (saved?.src ? { ...DEFAULT, ...saved } : null));
  const [sel, setSel] = useState("name");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [box, setBox] = useState(0);
  const wrap = useRef(null), fileRef = useRef(null), drag = useRef(null);

  useEffect(() => { QRCode.toDataURL(`${SITE_URL}/bilet#t=PrzykladowyKlucz`, { margin: 2, width: 300 }).then(setQrImg).catch(() => {}); }, []);
  useEffect(() => {
    if (!wrap.current) return undefined;
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [t?.src]);

  const setF = (k, p) => setT((cur) => ({ ...cur, [k]: { ...cur[k], ...p } }));

  const upload = async (file) => {
    if (!file) return;
    setMsg("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setMsg("Wybierz obraz JPG, PNG albo WebP.");
    if (file.size > 20 * 1024 * 1024) return setMsg("Plik jest większy niż 20 MB.");
    setBusy("upload");
    try {
      const { file: jpg, w, h } = await toJpeg(file);
      if (w < 800) throw new Error(`Obraz ma tylko ${w} px szerokości — do druku potrzeba co najmniej 1600 px.`);
      const src = (await base44.integrations.Core.UploadPublicFile({ file: jpg })).file_url;
      setT((cur) => ({ ...(cur || DEFAULT), src, w, h }));
      setMsg("Wzór wgrany. Przeciągnij pola na miejsca i zapisz.");
    } catch (e) { setMsg(e.message || "Nie udało się wgrać obrazu."); }
    setBusy("");
  };

  const preview = async () => {
    setBusy("pdf"); setMsg("");
    const win = window.open("", "_blank");
    try {
      const r = await base44.functions.invoke("ticketsAdmin", { action: "test_pdf", event_id: event.id, template: t });
      const bytes = Uint8Array.from(atob(r.data.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      if (win) win.location.href = url; else window.location.href = url;
    } catch (e) { win?.close(); setMsg(e?.response?.data?.error || "Nie udało się przygotować podglądu."); }
    setBusy("");
  };

  const save = async (tpl) => {
    setBusy("save"); setMsg("");
    try {
      await base44.functions.invoke("ticketsAdmin", { action: "save", event_id: event.id, template: tpl });
      setMsg(tpl ? "Wzór zapisany — nowe i ponownie pobierane bilety mają ten wygląd." : "Przywrócono wzór domyślny exmortis.");
      if (!tpl) setT(null);
      await reload();
    } catch (e) { setMsg(e?.response?.data?.error || "Nie udało się zapisać."); }
    setBusy("");
  };

  // Przeciąganie pól (mysz i dotyk).
  const down = (k) => (e) => {
    e.preventDefault(); setSel(k);
    const r = wrap.current.getBoundingClientRect();
    drag.current = { k, x0: e.clientX, y0: e.clientY, fx: t[k].x, fy: t[k].y, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = drag.current; if (!d) return;
    setF(d.k, { x: clamp01(d.fx + (e.clientX - d.x0) / d.w), y: clamp01(d.fy + (e.clientY - d.y0) / d.h) });
  };
  const up = () => { drag.current = null; };
  const nudge = (k) => (e) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!m) return;
    e.preventDefault();
    setF(k, { x: clamp01(t[k].x + m[0]), y: clamp01(t[k].y + m[1]) });
  };

  const textStyle = (o) => ({
    left: `${o.x * 100}%`, top: `${o.y * 100}%`, fontFamily: fontCss(o.font), color: o.color, fontSize: `${o.size * box}px`, lineHeight: 1,
    transform: `translate(${o.align === "center" ? "-50%" : o.align === "right" ? "-100%" : "0"}, -50%)`, whiteSpace: "nowrap",
    textTransform: o.upper ? "uppercase" : "none",
  });
  const ring = (k) => (sel === k ? "outline outline-2 outline-[#C9A24A] outline-offset-2" : "outline outline-1 outline-dashed outline-white/50");
  const f = t?.[sel];

  return (
    <div className="space-y-6">
      <div className="text-sm text-foreground/65 leading-relaxed max-w-3xl space-y-2">
        <p>Wgraj gotowy projekt biletu jako obraz (np. z Canvy, w dowolnych proporcjach, najlepiej 2000 px szerokości lub więcej). Zostaw na nim puste miejsce na imię i nazwisko, kod QR i numer biletu — te trzy pola wpisuje automat, osobno dla każdej osoby.</p>
        <p className="text-foreground/50">Bez własnego wzoru bilety mają wygląd domyślny exmortis (czerń i złoto, tytuł, data, miejsce, imię i nazwisko, QR, numer).</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn-ghost !px-4 !py-3 disabled:opacity-50">
          {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {t?.src ? "ZMIEŃ OBRAZ WZORU" : "WGRAJ WZÓR BILETU"}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Wybierz obraz wzoru" onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
        <button type="button" onClick={preview} disabled={!!busy} className="btn-ghost !px-4 !py-3 disabled:opacity-50">{busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} PODGLĄD PDF</button>
        {t?.src && <button type="button" onClick={() => save(t)} disabled={!!busy} className="btn-relic !px-5 !py-3 disabled:opacity-50">{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ZAPISZ WZÓR</button>}
        {(t?.src || saved?.src) && <button type="button" onClick={() => window.confirm("Wrócić do wzoru domyślnego exmortis?") && save(null)} disabled={!!busy} className="btn-ghost !px-4 !py-3 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> WZÓR DOMYŚLNY</button>}
      </div>
      {msg && <p className="technical text-[10px] gold-text" role="status">{msg}</p>}

      {t?.src && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <div>
            <div ref={wrap} className="relative w-full select-none touch-none bg-[#111]" style={{ aspectRatio: `${t.w || 2} / ${t.h || 1}` }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <img src={t.src} alt="Wzór biletu" className="absolute inset-0 w-full h-full object-fill pointer-events-none" draggable={false} />
              <div role="button" tabIndex={0} aria-label="Pole: kod QR — przeciągnij albo przesuń strzałkami" onPointerDown={down("qr")} onKeyDown={nudge("qr")} onFocus={() => setSel("qr")}
                className={`absolute cursor-move ${ring("qr")}`} style={{ left: `${t.qr.x * 100}%`, top: `${t.qr.y * 100}%`, width: `${t.qr.size * 100}%`, aspectRatio: "1", background: t.qr.light }}>
                {qrImg && <img src={qrImg} alt="" className="w-full h-full pointer-events-none" draggable={false} />}
              </div>
              {["name", "code"].map((k) => (
                <div key={k} role="button" tabIndex={0} aria-label={`Pole: ${LABEL[k]} — przeciągnij albo przesuń strzałkami`} onPointerDown={down(k)} onKeyDown={nudge(k)} onFocus={() => setSel(k)}
                  className={`absolute cursor-move px-1 ${ring(k)}`} style={textStyle(t[k])}>{SAMPLE[k]}</div>
              ))}
            </div>
            <p className="text-xs text-foreground/45 mt-2">Kliknij pole, żeby je wybrać; przeciągnij albo przesuwaj strzałkami (z Shift — szybciej). Długie nazwiska PDF sam zmniejsza, żeby się zmieściły.</p>
          </div>

          <div className="border hairline p-4 space-y-4">
            <div className="flex gap-1.5" role="tablist" aria-label="Wybrane pole">
              {["name", "qr", "code"].map((k) => (
                <button key={k} type="button" role="tab" aria-selected={sel === k} onClick={() => setSel(k)} className={`technical text-[9px] px-2.5 py-2 border flex-1 ${sel === k ? "border-[#C9A24A] gold-text" : "hairline text-foreground/55"}`}>{LABEL[k].toUpperCase()}</button>
              ))}
            </div>
            {sel === "qr" ? (
              <>
                <label className="block text-sm">Wielkość: {Math.round(f.size * 100)}% szerokości
                  <input type="range" min="0.08" max="0.5" step="0.005" value={f.size} onChange={(e) => setF("qr", { size: Number(e.target.value) })} className="w-full accent-[#C9A24A]" />
                </label>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="flex items-center gap-2">Kropki <input type="color" value={f.dark} onChange={(e) => setF("qr", { dark: e.target.value })} className="h-9 w-12 bg-transparent" /></label>
                  <label className="flex items-center gap-2">Tło <input type="color" value={f.light} onChange={(e) => setF("qr", { light: e.target.value })} className="h-9 w-12 bg-transparent" /></label>
                </div>
                <p className="text-xs text-foreground/45">Dla pewnego odczytu: ciemne kropki na jasnym tle i co najmniej 3 cm na wydruku.</p>
              </>
            ) : (
              <>
                <label className="block text-sm">Wielkość tekstu
                  <input type="range" min="0.01" max={sel === "name" ? "0.12" : "0.08"} step="0.001" value={f.size} onChange={(e) => setF(sel, { size: Number(e.target.value) })} className="w-full accent-[#C9A24A]" />
                </label>
                <label className="block text-sm">Czcionka
                  <select value={f.font} onChange={(e) => setF(sel, { font: e.target.value })} className="mt-1 w-full bg-[#0D0D0E] border hairline px-3 py-2">
                    {FONTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2">Kolor <input type="color" value={f.color} onChange={(e) => setF(sel, { color: e.target.value })} className="h-9 w-12 bg-transparent" /></label>
                  <div className="flex border hairline ml-auto" role="group" aria-label="Wyrównanie">
                    {[["left", "Do lewej"], ["center", "Do środka"], ["right", "Do prawej"]].map(([v, l]) => (
                      <button key={v} type="button" aria-pressed={f.align === v} onClick={() => setF(sel, { align: v })} className={`px-2.5 py-1.5 text-xs ${f.align === v ? "bg-[#C9A24A]/20 gold-text" : "text-foreground/60"}`}>{l.split(" ")[1]}</button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.upper} onChange={(e) => setF(sel, { upper: e.target.checked })} className="h-4 w-4 accent-[#C9A24A]" /> Wielkie litery</label>
                <p className="text-xs text-foreground/45">Punkt zaczepienia: {f.align === "center" ? "środek" : f.align === "left" ? "lewa krawędź" : "prawa krawędź"} tekstu.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}