import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";
import useOnlineText from "@/content/useOnlineText";
import { plWhenFull } from "@/components/exmortis/events/time";
import JoinBefore from "@/components/exmortis/events/join/JoinBefore";
import JoinOpen from "@/components/exmortis/events/join/JoinOpen";
import NotFoundContent from "@/components/exmortis/NotFoundContent";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// /spotkania/:slug/dolacz i /:short/dolacz — stan pokoju liczy serwer; link przychodzi dopiero w oknie czasowym.
export default function JoinMeeting() {
  useNoIndex();
  const { slug, short } = useParams();
  const t = useOnlineText();
  const preview = new URLSearchParams(window.location.search).get("stan");
  const [data, setData] = useState(undefined);
  const load = useCallback(() => base44.functions.invoke("eventsPublic", { action: "join", slug: slug || short, preview: preview || undefined })
    .then((r) => setData(r.data)).catch(() => setData(null)), [slug, short, preview]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (data?.state !== "otwarte" || preview) return; const i = setInterval(load, 60000); return () => clearInterval(i); }, [data?.state, load, preview]);

  if (data === undefined) return <div className="min-h-[70svh]" />;
  if (data === null || data.state === "stacjonarne") return <NotFoundContent />;
  return (
    <div className="min-h-[70svh] pt-32 pb-24 px-5">
      <div className="mx-auto max-w-xl">
        <p className="technical text-[10px] gold-text mb-4">SPOTKANIE ONLINE</p>
        <h1 className="shop-heading text-3xl md:text-4xl text-[#F5EFE1]">{data.title}</h1>
        <p className="font-mono text-sm text-[#F5EFE1]/70 mt-3">{cap(plWhenFull(data.start_datetime))}</p>
        {data.state === "przed" && <JoinBefore data={data} onOpen={preview ? () => {} : load} />}
        {data.state === "otwarte" && <JoinOpen data={data} preview={!!preview} />}
        {data.state === "po" && (
          <>
            <p className="text-foreground/80 mt-8 leading-relaxed">{t("po")}</p>
            {data.recording_url && <a href={data.recording_url} target="_blank" rel="noreferrer" className="btn-ghost mt-6">OBEJRZYJ NAGRANIE</a>}
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