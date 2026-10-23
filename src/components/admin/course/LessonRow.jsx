import React, { useState } from "react";
import { Upload, Loader2, Trash2, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";

const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";

// Rozpoznanie źródła z adresu (ostateczne sprawdzenie robi serwer przy odtwarzaniu).
export function videoSource(url) {
  const s = String(url || "").trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return { ok: false, label: "To nie jest poprawny adres." }; }
  if (u.protocol !== "https:") return { ok: false, label: "Adres musi zaczynać się od https://" };
  const h = u.hostname.toLowerCase();
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h)) return { ok: true, label: "YouTube — ustaw film jako „niepubliczny”." };
  if (/(^|\.)vimeo\.com$/.test(h)) return { ok: true, label: "Vimeo — najlepiej z ograniczeniem osadzania do exmortis.pl." };
  if (/mediadelivery\.net$/.test(h)) return { ok: true, label: "Bunny Stream." };
  if (/\.(mp4|m4v|webm)$/i.test(u.pathname)) return { ok: true, label: `Twój serwer (${h}) — domena musi być na liście: Ustawienia strony → Biblioteka → dozwolone domeny wideo.` };
  return { ok: false, label: "Obsługiwane: plik .mp4/.webm z Twojego serwera, YouTube, Vimeo, Bunny Stream." };
}

export default function LessonRow({ lesson, onChange, domains, onAddDomain }) {
  const [f, setF] = useState(lesson);
  const [busy, setBusy] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [test, setTest] = useState(null); // null | "load" | "ok" | "err"
  const [testInfo, setTestInfo] = useState("");
  const [testUrl, setTestUrl] = useState("");
  const serverHost = (() => {
    try { const u = new URL(String(f.video_url || "").trim()); return /\.(mp4|m4v|webm)$/i.test(u.pathname) ? u.hostname.toLowerCase() : null; } catch { return null; }
  })();
  const hostMissing = serverHost && Array.isArray(domains) && !domains.includes(serverHost);

  const save = async (extra = {}) => {
    const src = videoSource(f.video_url);
    if (src && !src.ok && !extra.video_uri) { setMsg(src.label); return; }
    setBusy("save");
    await base44.entities.CourseLesson.update(lesson.id, {
      module: f.module || "", title: f.title, order: Number(f.order) || 0, description: f.description || "",
      duration_min: f.duration_min ? Number(f.duration_min) : null, published: !!f.published,
      video_url: String(f.video_url || "").trim(), ...extra,
    });
    setBusy(""); setMsg("Zapisano"); onChange();
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("up"); setMsg("");
    try {
      if (file.size > 500 * 1024 * 1024) { setBusy(""); setMsg("Plik ma ponad 500 MB. Wgraj go na swój serwer albo Vimeo i wklej adres powyżej."); return; }
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
      <div className="space-y-1">
        <input className={inp} value={f.video_url || ""} onChange={(e) => set("video_url", e.target.value)}
          placeholder="Adres filmu z Twojego serwera, np. https://wideo.exmortis.pl/kurs/lekcja-1.mp4" aria-label="Adres wideo" />
        {(() => { const v = videoSource(f.video_url); return v && !serverHost ? <p className={`text-xs ${v.ok ? "text-foreground/50" : "text-[#E8C547]"}`}>{v.label}</p> : null; })()}
        {f.video_uri && f.video_url && <p className="text-xs text-[#E8C547]">Wgrany plik ma pierwszeństwo — usuń go, żeby lekcja używała adresu.</p>}
        {serverHost && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {hostMissing ? (
              <>
                <span className="text-xs text-[#E8C547]">Domena {serverHost} nie jest na liście zaufanych — klient nie zobaczy filmu.</span>
                <button type="button" onClick={() => onAddDomain(serverHost)} className="btn-ghost !px-3 !py-1.5 text-[10px]">DODAJ {serverHost.toUpperCase()}</button>
              </>
            ) : domains ? <span className="text-xs text-[#9FD3A0]">Twój serwer ({serverHost}) — domena zaufana.</span> : null}
            <button type="button" onClick={async () => {
              if (test) { setTest(null); return; }
              setTestInfo(""); setTestUrl(String(f.video_url).trim());
              // Przy włączonej ochronie podgląd dostaje podpisany link (jak klient).
              const r = await base44.functions.invoke("adminSettings", { action: "video_sign_preview", url: String(f.video_url).trim() }).catch(() => null);
              if (r?.data?.url) setTestUrl(r.data.url);
              setTest("load");
            }} className="btn-ghost !px-3 !py-1.5 text-[10px]">{test ? "ZAMKNIJ PODGLĄD" : "SPRAWDŹ ODTWARZANIE"}</button>
          </div>
        )}
        {serverHost && test && (
          <div className="pt-2 space-y-2">
            <video src={testUrl} controls preload="metadata" playsInline className="w-full max-w-md bg-black aspect-video"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                const min = Number.isFinite(d) ? Math.max(1, Math.round(d / 60)) : null;
                setTest("ok");
                setTestInfo(min ? `Działa. Długość: ${min} min.${!f.duration_min ? " Wpisałem ją w pole „min” — zapisz lekcję." : ""}` : "Działa.");
                if (min && !f.duration_min) set("duration_min", min);
              }}
              onError={() => { setTest("err"); setTestInfo("Nie udało się odtworzyć. Sprawdź: adres otwiera film w przeglądarce, serwer podaje typ video/mp4 (albo video/webm) i obsługuje przewijanie (Accept-Ranges: bytes), film jest w H.264 + AAC."); }} />
            {testInfo && <p className={`text-xs ${test === "err" ? "text-[#E8C547]" : "text-[#9FD3A0]"}`}>{testInfo}</p>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost cursor-pointer !px-3 !py-2 text-[10px]">
          {busy === "up" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {f.video_uri ? "ZMIEŃ WIDEO" : "WGRAJ WIDEO"}
          <input type="file" accept="video/*" className="hidden" onChange={upload} disabled={!!busy} />
        </label>
        <span className="text-xs text-foreground/50">{f.video_name || (f.video_url ? "wideo z adresu" : "brak wideo")}</span>
        {f.video_uri && (
          <button type="button" onClick={() => { set("video_uri", ""); set("video_name", ""); save({ video_uri: "", video_name: "" }); }} disabled={!!busy}
            className="text-xs text-foreground/50 underline hover:text-[#E8C547]">usuń plik</button>
        )}
        <label className="flex items-center gap-2 text-xs text-foreground/60 cursor-pointer">
          <input type="checkbox" checked={!!f.published} onChange={(e) => set("published", e.target.checked)} className="h-4 w-4 accent-[#C9A24A]" /> Widoczna dla klientów
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