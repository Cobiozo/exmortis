import React, { useEffect } from "react";
import useOnlineText from "@/content/useOnlineText";

// Pokój otwarty: przekierowanie do Zooma + przycisk awaryjny. Bez linku — prośba o odświeżenie.
export default function JoinOpen({ data, preview }) {
  const t = useOnlineText();
  useEffect(() => { if (data.join_link && !preview) window.location.href = data.join_link; }, [data.join_link, preview]);
  if (data.missing) return <p className="text-foreground/80 mt-8 leading-relaxed">{t("brak")}</p>;
  return (
    <>
      <a href={data.join_link} className="btn-relic mt-8 min-h-[44px] w-full sm:w-auto">{t("otwarte.przycisk").toUpperCase()}</a>
      {data.join_password && <p className="mt-4 text-[#F5EFE1]">Hasło do pokoju: <span className="font-mono gold-text">{data.join_password}</span></p>}
      <p className="text-foreground/70 mt-6 leading-relaxed text-sm">{t("otwarte.info")}</p>
    </>
  );
}