import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CameraOff, Flashlight, Keyboard, RotateCcw, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Skaner biletów: kamera telefonu czyta kod QR, serwer od razu potwierdza wejście (jedno wejście na bilet).
// Dostęp: administrator albo osoba z uprawnieniem nadanym w panelu (Spotkania → Skanowanie biletów).
const hhmm = (iso) => (iso ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "");
const day = (iso) => new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const LOOK = {
  ok: { bg: "#0F5132", title: "WEJŚCIE OK", tone: [880, 1320] },
  wykorzystany: { bg: "#7A1518", title: "BILET JUŻ UŻYTY", tone: [220, 180] },
  anulowany: { bg: "#7A1518", title: "BILET ANULOWANY", tone: [220, 180] },
  nieznany: { bg: "#7A1518", title: "NIEZNANY BILET", tone: [220, 180] },
  nieczytelny: { bg: "#6B4E00", title: "TO NIE JEST BILET EXMORTIS", tone: [330, 330] },
  inne_wydarzenie: { bg: "#6B4E00", title: "BILET NA INNE WYDARZENIE", tone: [330, 330] },
  brak_uprawnien: { bg: "#6B4E00", title: "BRAK UPRAWNIEŃ DO TEGO WYDARZENIA", tone: [330, 330] },
  cofniety: { bg: "#26262A", title: "WEJŚCIE COFNIĘTE", tone: [440] },
  bez_zmian: { bg: "#26262A", title: "BEZ ZMIAN", tone: [440] },
  blad: { bg: "#6B4E00", title: "NIE SPRAWDZONO — BRAK POŁĄCZENIA", tone: [330, 330] },
};

let audio = null;
function beep(freqs) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      const t = audio.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.13);
    });
  } catch { /* bez dźwięku */ }
}

export default function Skaner() {
  const [info, setInfo] = useState(null); // { allowed, events }
  const [eventId, setEventId] = useState(() => { try { return localStorage.getItem("exm_scan_event") || ""; } catch { return ""; } });
  const [counts, setCounts] = useState(null);
  const [recent, setRecent] = useState([]);
  const [result, setResult] = useState(null);
  const [cam, setCam] = useState("off"); // off | starting | on | denied | none
  const [torch, setTorch] = useState(null); // null = brak latarki
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const videoRef = useRef(null), canvasRef = useRef(null), streamRef = useRef(null);
  const busyRef = useRef(false), lastRef = useRef({ raw: "", at: 0 }), loopRef = useRef(0), detectorRef = useRef(null);
  const resultTimer = useRef(0);

  useEffect(() => {
    document.title = "Skaner biletów · exmortis";
    base44.functions.invoke("tickets", { action: "scanner" })
      .then((r) => {
        setInfo(r.data);
        const evs = r.data?.events || [];
        setEventId((cur) => (evs.some((e) => e.id === cur) ? cur : (evs.find((e) => Date.parse(e.start_datetime) + (e.duration_minutes || 60) * 60000 > Date.now())?.id || evs[0]?.id || "")));
      })
      .catch(() => setInfo({ allowed: false, error: true }));
  }, []);

  const loadStats = useCallback(() => {
    if (!eventId) return;
    base44.functions.invoke("tickets", { action: "stats", event_id: eventId })
      .then((r) => { setCounts(r.data.counts); setRecent(r.data.recent || []); }).catch(() => {});
  }, [eventId]);
  useEffect(() => { try { localStorage.setItem("exm_scan_event", eventId); } catch { /* */ } loadStats(); }, [eventId, loadStats]);

  const show = (r) => {
    clearTimeout(resultTimer.current);
    setResult(r);
    const look = LOOK[r.result] || LOOK.nieznany;
    beep(look.tone);
    try { navigator.vibrate?.(r.result === "ok" ? 120 : [200, 80, 200]); } catch { /* */ }
    resultTimer.current = setTimeout(() => setResult(null), r.result === "ok" ? 1800 : 4500);
  };

  const check = useCallback(async (payload, undo = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await base44.functions.invoke("tickets", { action: "check", event_id: eventId || null, undo, ...payload });
      show(r.data);
      if (r.data?.counts) setCounts(r.data.counts);
      if (["ok", "cofniety"].includes(r.data?.result)) loadStats();
    } catch (e) {
      show({ result: e?.response?.status === 403 ? "brak_uprawnien" : "blad", note: e?.response?.data?.error });
    } finally {
      busyRef.current = false;
    }
  }, [eventId, loadStats]);

  // Pętla odczytu: natywny BarcodeDetector (Android/Chrome) albo jsQR (iPhone i reszta).
  const scanFrame = useCallback(async () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || busyRef.current || result) return;
    let raw = null;
    try {
      if (detectorRef.current?.native) {
        const codes = await detectorRef.current.native.detect(v);
        raw = codes?.[0]?.rawValue || null;
      } else if (detectorRef.current?.jsqr) {
        const c = canvasRef.current, w = Math.min(640, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w);
        if (!w || !h) return;
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        raw = detectorRef.current.jsqr(img.data, w, h, { inversionAttempts: "attemptBoth" })?.data || null;
      }
    } catch { /* klatka nieczytelna */ }
    if (!raw) return;
    const now = Date.now();
    if (raw === lastRef.current.raw && now - lastRef.current.at < 4000) return;
    lastRef.current = { raw, at: now };
    check({ raw });
  }, [check, result]);

  useEffect(() => {
    if (cam !== "on") return undefined;
    let stop = false, last = 0;
    const tick = (t) => {
      if (stop) return;
      if (t - last > 140) { last = t; scanFrame(); }
      loopRef.current = requestAnimationFrame(tick);
    };
    loopRef.current = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(loopRef.current); };
  }, [cam, scanFrame]);

  const startCam = async () => {
    setCam("starting");
    try {
      if ("BarcodeDetector" in window && (await window.BarcodeDetector.getSupportedFormats?.())?.includes("qr_code")) {
        detectorRef.current = { native: new window.BarcodeDetector({ formats: ["qr_code"] }) };
      } else {
        detectorRef.current = { jsqr: (await import("jsqr")).default };
      }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = s;
      const v = videoRef.current;
      v.srcObject = s; v.setAttribute("playsinline", "true"); v.muted = true;
      await v.play();
      const track = s.getVideoTracks()[0];
      setTorch(track?.getCapabilities?.()?.torch ? false : null);
      setCam("on");
      try { await navigator.wakeLock?.request("screen"); } catch { /* bez blokady wygaszania */ }
    } catch (e) {
      setCam(e?.name === "NotAllowedError" ? "denied" : "none");
      setManual(true);
    }
  };
  const stopCam = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setCam("off"); };
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);
  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch { setTorch(null); }
  };

  if (!info) return <main className="min-h-[100svh] bg-[#0A0A0B] flex items-center justify-center text-foreground/50">Ładowanie…</main>;
  if (!info.allowed) {
    return (
      <main className="min-h-[100svh] bg-[#0A0A0B] text-foreground flex items-center justify-center px-6 text-center">
        <div className="max-w-sm space-y-5">
          <p className="technical text-[10px] gold-text">EXMORTIS · SKANER BILETÓW</p>
          <p className="text-foreground/75 leading-relaxed">{info.error ? "Nie udało się sprawdzić uprawnień. Spróbuj ponownie." : "To konto nie ma uprawnienia do sprawdzania biletów. Poproś administratora o dodanie Twojego adresu e-mail."}</p>
          <Link to="/" className="btn-ghost">STRONA GŁÓWNA</Link>
        </div>
      </main>
    );
  }

  const ev = (info.events || []).find((e) => e.id === eventId);
  const look = result ? LOOK[result.result] || LOOK.nieznany : null;
  return (
    <main className="min-h-[100svh] bg-[#0A0A0B] text-foreground flex flex-col">
      <header className="px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 border-b hairline space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="technical text-[10px] gold-text">EXMORTIS · SKANER BILETÓW</p>
          {counts && <p className="font-mono text-sm" aria-live="polite"><span className="gold-text">{counts.checked}</span> / {counts.sold} <span className="text-foreground/45 text-xs">wpuszczonych</span></p>}
        </div>
        {(info.events || []).length ? (
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Wydarzenie"
            className="w-full bg-[#0D0D0E] border hairline px-3 py-3 text-base focus:border-[#C9A24A] focus:outline-none">
            {info.events.map((e) => <option key={e.id} value={e.id}>{e.title} · {day(e.start_datetime)}</option>)}
          </select>
        ) : <p className="text-sm text-foreground/60">Brak wydarzeń z biletami w najbliższym czasie.</p>}
      </header>

      <section className="relative flex-1 min-h-[52svh] bg-black overflow-hidden">
        <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${cam === "on" ? "" : "opacity-0"}`} muted playsInline aria-label="Podgląd kamery" />
        <canvas ref={canvasRef} className="hidden" />
        {cam === "on" && <div className="absolute inset-0 pointer-events-none flex items-center justify-center"><div className="w-[62vmin] h-[62vmin] max-w-[340px] max-h-[340px] border-2 border-[#C9A24A]/80 rounded-lg shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" /></div>}
        {cam !== "on" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {cam === "denied" && <p className="text-sm text-[#E8C547] max-w-xs">Brak zgody na kamerę. Zezwól na kamerę w ustawieniach przeglądarki albo wpisuj numery biletów ręcznie.</p>}
            {cam === "none" && <p className="text-sm text-[#E8C547] max-w-xs">Nie udało się włączyć kamery. Wpisuj numery biletów ręcznie.</p>}
            <button type="button" onClick={startCam} disabled={cam === "starting" || !eventId} className="btn-relic !px-8 !py-4 disabled:opacity-50">
              <Camera className="h-5 w-5" /> {cam === "starting" ? "WŁĄCZAM…" : "WŁĄCZ KAMERĘ"}
            </button>
          </div>
        )}
        {cam === "on" && (
          <div className="absolute bottom-3 inset-x-3 flex justify-between">
            <button type="button" onClick={stopCam} className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center" aria-label="Wyłącz kamerę"><CameraOff className="h-5 w-5" /></button>
            {torch !== null && <button type="button" onClick={toggleTorch} className={`h-12 w-12 rounded-full flex items-center justify-center ${torch ? "bg-[#C9A24A] text-black" : "bg-black/60"}`} aria-label="Latarka" aria-pressed={!!torch}><Flashlight className="h-5 w-5" /></button>}
          </div>
        )}

        {result && (
          <button type="button" onClick={() => setResult(null)} className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 gap-3" style={{ background: look.bg }} aria-live="assertive">
            <p className="font-bold text-2xl sm:text-3xl tracking-wide text-white">{look.title}</p>
            {result.name && <p className="shop-heading text-2xl text-white break-words">{result.name}</p>}
            {result.code && <p className="font-mono text-xl text-white/90 tracking-[0.15em]">{result.code}</p>}
            {result.result === "wykorzystany" && result.checked_at && <p className="text-white/90">Wejście o {hhmm(result.checked_at)}{result.checked_by ? ` · ${result.checked_by}` : ""}</p>}
            {result.result === "inne_wydarzenie" && result.event_title && <p className="text-white/90">Bilet na: {result.event_title}</p>}
            {result.note && <p className="text-white/80 text-sm">{result.note}</p>}
            <p className="text-white/60 text-xs mt-4">Dotknij, aby skanować dalej</p>
          </button>
        )}
      </section>

      <section className="px-4 py-4 border-t hairline space-y-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {manual ? (
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) { check({ code: code.trim() }); setCode(""); } }} className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Numer biletu, np. KRT-4821" autoCapitalize="characters" autoComplete="off"
              aria-label="Numer biletu" className="flex-1 min-w-0 bg-transparent border hairline px-4 py-3 font-mono text-base focus:border-[#C9A24A] focus:outline-none" />
            <button type="submit" disabled={!eventId} className="btn-relic !px-5 disabled:opacity-50">SPRAWDŹ</button>
            <button type="button" onClick={() => setManual(false)} className="btn-ghost !px-3" aria-label="Zamknij wpisywanie"><X className="h-4 w-4" /></button>
          </form>
        ) : (
          <button type="button" onClick={() => setManual(true)} className="btn-ghost w-full"><Keyboard className="h-4 w-4" /> WPISZ NUMER BILETU</button>
        )}
        {recent.length > 0 && (
          <div>
            <p className="technical text-[10px] text-foreground/45 mb-2">OSTATNIE WEJŚCIA{ev ? ` · ${ev.title}` : ""}</p>
            <ul className="divide-y hairline border-y hairline text-sm">
              {recent.slice(0, 6).map((r, i) => (
                <li key={`${r.code}-${r.at}`} className="py-2 flex items-center gap-3">
                  <span className="font-mono text-xs text-foreground/50 w-11">{hhmm(r.at)}</span>
                  <span className="flex-1 min-w-0 truncate">{r.name}</span>
                  <span className="font-mono text-xs gold-text">{r.code}</span>
                  {i === 0 && <button type="button" onClick={() => window.confirm(`Cofnąć wejście ${r.name} (${r.code})?`) && check({ code: r.code }, true)} className="text-foreground/50 hover:text-foreground p-1" aria-label={`Cofnij wejście ${r.code}`}><RotateCcw className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
