import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";
import useOnlineText from "@/content/useOnlineText";
import { plWhenFull } from "@/components/exmortis/events/time";
import JoinBefore from "@/components/exmortis/events/join/JoinBefore";
import JoinOpen from "@/components/exmortis/events/join/JoinOpen";
import JoinGate from "@/components/exmortis/events/join/JoinGate";
import NotFoundContent from "@/components/exmortis/NotFoundContent";
import { joinFallback } from "@/content/joinFallback";
import WarsawNote from "@/components/exmortis/events/WarsawNote";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// /spotkania/:slug/dolacz i /:short/dolacz — stan pokoju liczy serwer; link przychodzi dopiero w oknie czasowym.
export default function JoinMeeting() {
  useNoIndex();
  const { slug, short } = useParams();
  const t = useOnlineText();
  const preview = new URLSearchParams(window.location.search).get("stan");
  const [data, setData] = useState(undefined);
  const metaKey = `join:${slug || short}`;
  const [waiting, setWaiting] = useState(false);
  // Osobisty klucz z linku w mailu (?t=…) albo zapamiętany na tym urządzeniu; z paska adresu znika od razu.
  const tKey = `exm_join_t:${slug || short}`;
  const [cred, setCred] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("t");
    if (fromUrl) {
      try { localStorage.setItem(tKey, fromUrl); } catch { /* */ }
      try { const u = new URL(window.location.href); u.searchParams.delete("t"); window.history.replaceState(null, "", u.pathname + u.search); } catch { /* */ }
      return { t: fromUrl };
    }
    try { const s = localStorage.getItem(tKey); return s ? { t: s } : {}; } catch { return {}; }
  });
  const credRef = React.useRef(cred);
  credRef.current = cred;
  // Limit 3 s; brak odpowiedzi lub błąd sieci/serwera → "Łączymy…" i ponowienie co 5 s. 404 → strona nie istnieje.
  const load = useCallback(() => Promise.race([
    base44.functions.invoke("eventsPublic", { action: "join", slug: slug || short, preview: preview || undefined, ...credRef.current }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
  ]).then((r) => {
    setData(r.data); setWaiting(false);
    if (r.data?.ok_token) { try { localStorage.setItem(tKey, r.data.ok_token); } catch { /* */ } setCred({ t: r.data.ok_token }); }
    if (r.data?.need && credRef.current.t && !credRef.current.email) { try { localStorage.removeItem(tKey); } catch { /* */ } }
    try { localStorage.setItem(metaKey, JSON.stringify({ s: r.data.start_datetime, o: r.data.open_minutes, d: r.data.duration_minutes })); } catch {}
  }).catch((e) => {
    if (e?.response?.status === 404) return setData(null);
    setWaiting(true);
  }), [slug, short, preview, metaKey, tKey]);
  const tryEmail = async (email) => { credRef.current = { email }; setCred({ email }); await load(); };
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!waiting) return; const i = setInterval(load, 5000); return () => clearInterval(i); }, [waiting, load]);
  const knownOpen = (() => { try { const m = JSON.parse(localStorage.getItem(metaKey)); const st = new Date(m.s).getTime(), n = Date.now();
    return n >= st - (m.o || 15) * 60000 && n <= st + ((m.d || 60) + 30) * 60000; } catch { return false; } })();
  useEffect(() => { if (data?.state !== "otwarte" || preview) return; const i = setInterval(load, 60000); return () => clearInterval(i); }, [data?.state, load, preview]);

  const fb = data === undefined && waiting ? joinFallback(slug || short) : null;
  if (fb) return (
    <div className="min-h-[70svh] pt-32 pb-24 px-5">
      <div className="mx-auto max-w-xl">
        <p className="technical text-[10px] gold-text mb-4">SPOTKANIE ONLINE</p>
        <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1]">{fb.title}</h1>
        <p className="font-mono text-sm text-[#F5EFE1]/70 mt-3">{cap(plWhenFull(fb.start_datetime))}<WarsawNote iso={fb.start_datetime} /></p>
        {fb.state === "przed" && <JoinBefore data={fb} onOpen={load} />}
        {fb.state !== "przed" && <p className="technical text-xs gold-text mt-8" role="status" aria-live="polite">{fb.state === "otwarte" ? "ŁĄCZYMY… POKÓJ JEST OTWARTY" : "ŁĄCZYMY…"}</p>}
      </div>
    </div>
  );
  if (data === undefined) return (
    <div className="min-h-[70svh] pt-32 pb-24 px-5 flex justify-center" role="status" aria-live="polite">
      {<p className="technical text-xs gold-text">{knownOpen ? "ŁĄCZYMY… POKÓJ JEST OTWARTY" : "ŁĄCZYMY…"}</p>}
    </div>
  );
  if (data === null || data.state === "stacjonarne") return <NotFoundContent />;
  return (
    <div className="min-h-[70svh] pt-32 pb-24 px-5">
      <div className="mx-auto max-w-xl">
        <p className="technical text-[10px] gold-text mb-4">SPOTKANIE ONLINE</p>
        <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1]">{data.title}</h1>
        <p className="font-mono text-sm text-[#F5EFE1]/70 mt-3">{cap(plWhenFull(data.start_datetime))}<WarsawNote iso={data.start_datetime} /></p>
        {data.state === "przed" && <JoinBefore data={data} onOpen={preview ? () => {} : load} />}
        {(data.state === "otwarte" || data.state === "po") && data.need && <JoinGate state={data.state} error={cred.email || cred.t ? data.error : ""} onSubmit={tryEmail} />}
        {data.state === "otwarte" && !data.need && <JoinOpen data={data} preview={!!preview} />}
        {data.state === "po" && !data.need && (
          <>
            <p className="text-foreground/80 mt-8 leading-relaxed">{t("po")}</p>
            {data.recording_in_account && (
              <div className="mt-6 border hairline p-5">
                <p className="text-foreground/75 leading-relaxed text-sm">Nagranie jest w koncie osób zapisanych na to spotkanie. Zaloguj się adresem e-mail podanym przy zapisie.</p>
                <Link to="/konto?tab=spotkania" className="btn-relic mt-4">OBEJRZYJ W KONCIE</Link>
              </div>
            )}
          </>
        )}
        {data.state === "odwolane" && (
          <>
            <p className="text-foreground/80 mt-8">{t("odwolane")}</p>
            <Link to="/spotkania" className="btn-ghost mt-6">ZOBACZ KOLEJNE SPOTKANIA</Link>
          </>
        )}
      </div>
    </div>
  );
}