import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { videoSource } from "@/components/admin/course/LessonRow";
import { Input } from "./ui";

const wawNow = (h) => {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(Date.now() + h * 3600000))) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
// „2026-11-02T22:00” (czas polski z formularza) → milisekundy.
const wawMs = (v) => {
  if (!v) return null;
  const [d, t = "00:00"] = String(v).split("T");
  const guess = Date.parse(`${d}T${t}:00Z`);
  const off = (ms) => { const p = {}; for (const x of new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms))) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - ms; };
  let ms = guess - off(guess); ms = guess - off(ms);
  return ms;
};

// Nagranie spotkania: plik z Twojego serwera (albo Vimeo/YouTube niepubliczne), widoczne tylko w kontach
// zapisanych (Moje konto → Spotkania) do wybranej godziny. Nigdy publicznie i nigdy jako link w mailu.
export default function RecordingField(p) {
  const { form: f, set } = p;
  const [domains, setDomains] = useState(null);
  const [prot, setProt] = useState(null);
  const [test, setTest] = useState(null);
  const [testUrl, setTestUrl] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    base44.functions.invoke("libraryAdmin", { action: "settings" }).then((r) => setDomains(r.data?.settings?.video_domains || [])).catch(() => setDomains(null));
    base44.functions.invoke("adminSettings", { action: "video_get" }).then((r) => setProt(r.data)).catch(() => setProt(null));
  }, []);

  const url = String(f.recording_url || "").trim();
  const src = videoSource(url);
  const host = (() => { try { const u = new URL(url); return /\.(mp4|m4v|webm)$/i.test(u.pathname) ? u.hostname.toLowerCase() : null; } catch { return null; } })();
  const hostMissing = host && Array.isArray(domains) && !domains.includes(host);
  const untilMs = wawMs(f.recording_until);
  const live = url && untilMs && untilMs > Date.now();

  const addDomain = async () => {
    try { const r = await base44.functions.invoke("libraryAdmin", { action: "add_video_domain", domain: host }); setDomains(r.data.video_domains || []); }
    catch (e) { setMsg(e?.response?.data?.error || "Nie udało się dodać domeny."); }
  };
  const preview = async () => {
    if (test) { setTest(null); return; }
    setTestUrl(url);
    const r = await base44.functions.invoke("adminSettings", { action: "video_sign_preview", url }).catch(() => null);
    if (r?.data?.url) setTestUrl(r.data.url);
    setTest("load");
  };

  return (
    <div className="space-y-4">
      <Input id="recording_url" type="url" inputMode="url" label="Plik nagrania (Twój serwer: …/v/nazwa.mp4, albo Vimeo / YouTube niepubliczne)" placeholder="https://wideo.exmortis.pl/v/1-listopada.mp4" {...p} />
      {src && !host && <p className={`text-xs ${src.ok ? "text-foreground/50" : "text-[#E8C547]"}`}>{src.label}</p>}
      {host && (
        <div className="flex flex-wrap items-center gap-3">
          {hostMissing ? (
            <>
              <span className="text-xs text-[#E8C547]">Domena {host} nie jest na liście zaufanych — nagranie się nie odtworzy.</span>
              <button type="button" onClick={addDomain} className="btn-ghost !px-3 !py-1.5 text-[10px]">DODAJ {host.toUpperCase()}</button>
            </>
          ) : domains ? <span className="text-xs text-[#9FD3A0]">Twój serwer ({host}) — domena zaufana.</span> : null}
          <button type="button" onClick={preview} className="btn-ghost !px-3 !py-1.5 text-[10px]">{test ? "ZAMKNIJ PODGLĄD" : "SPRAWDŹ ODTWARZANIE"}</button>
        </div>
      )}
      {host && test && (
        <div className="space-y-2">
          <video src={testUrl} controls preload="metadata" playsInline className="w-full max-w-md bg-black aspect-video"
            onLoadedMetadata={() => setTest("ok")} onError={() => setTest("err")} />
          {test === "ok" && <p className="text-xs text-[#9FD3A0]">Działa.</p>}
          {test === "err" && <p className="text-xs text-[#E8C547]">Nie udało się odtworzyć. Sprawdź adres, typ pliku (MP4: H.264 + AAC) i — przy włączonej ochronie — skrypt stream.php na serwerze.</p>}
        </div>
      )}
      {host && prot && !prot.enabled && (
        <p className="text-xs text-[#E8C547] leading-relaxed">Ochrona filmów jest wyłączona — zalogowana osoba mogłaby podejrzeć adres pliku. Przed udostępnieniem włącz ją w <Link to="/admin/ustawienia" className="underline">Ustawieniach strony</Link> (Ochrona filmów kursu: klucz + stream.php).</p>
      )}
      {msg && <p className="text-xs text-[#E8C547]">{msg}</p>}

      <div className="border hairline p-4 space-y-3">
        <p className="technical text-[10px] text-foreground/55">UDOSTĘPNIJ W KONTACH ZAPISANYCH</p>
        <div className="flex flex-wrap gap-2">
          {[[24, "24 H OD TERAZ"], [48, "48 H"], [168, "7 DNI"]].map(([h, l]) => (
            <button key={h} type="button" disabled={!url} onClick={() => set({ recording_until: wawNow(h) })}
              className="technical text-[10px] border hairline px-3 py-2 text-foreground/70 hover:text-[#C9A24A] hover:border-[#C9A24A] disabled:opacity-40">{l}</button>
          ))}
          {f.recording_until && <button type="button" onClick={() => set({ recording_until: "" })} className="technical text-[10px] border border-[#BC1E22]/50 px-3 py-2 text-[#E8676A]">ZAKOŃCZ UDOSTĘPNIANIE</button>}
        </div>
        <Input id="recording_until" type="datetime-local" label="Widoczne do (czas polski)" {...p} />
        <p className={`text-sm ${live ? "text-[#9FD3A0]" : "text-foreground/55"}`}>
          {!url ? "Najpierw wpisz plik nagrania."
            : live ? `Po zapisaniu spotkania: nagranie widoczne w kontach zapisanych do ${new Date(untilMs).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "long", timeStyle: "short" })}. Zapisani dostaną mail z linkiem do konta.`
            : "Niewidoczne dla nikogo. Wybierz czas powyżej i zapisz spotkanie."}
        </p>
        <p className="text-xs text-foreground/45 leading-relaxed">Nagranie widzi tylko zalogowana osoba zapisana na to spotkanie (Moje konto → Spotkania), bez pobierania, ze znakiem wodnym z jej e-mailem. Kto nie ma konta, zakłada je na adres z zapisu. Mail z nagraniem nie zawiera linku do pliku.</p>
      </div>
    </div>
  );
}
