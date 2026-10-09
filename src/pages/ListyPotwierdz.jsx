import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

// Strona z linku „Potwierdź zapis na Listy powrotu”.
export default function ListyPotwierdz() {
  const [state, setState] = useState("loading");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t") || "";
    base44.functions.invoke("subscribeNewsletter", { action: "confirm", token })
      .then((r) => setState(r.data.ok ? "ok" : "bad"))
      .catch(() => setState("bad"));
  }, []);

  return (
    <section className="min-h-[70svh] flex items-center justify-center px-5 py-24 text-center">
      <div className="max-w-lg space-y-6">
        <p className="technical text-[10px] gold-text">LISTY POWROTU</p>
        {state === "loading" && <div className="mx-auto w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />}
        {state === "ok" && <>
          <h1 className="relic-heading text-3xl md:text-4xl">Zapis potwierdzony</h1>
          <p className="text-foreground/70">Pierwszy list przyjdzie w najbliższy poniedziałek. Wypisać się możesz jednym kliknięciem w każdym liście.</p>
        </>}
        {state === "bad" && <>
          <h1 className="relic-heading text-3xl md:text-4xl">Link nieaktywny</h1>
          <p className="text-foreground/70">Ten link został już użyty albo wygasł (ważny 7 dni). Możesz zapisać się ponownie.</p>
        </>}
        {state !== "loading" && <Link to="/" className="btn-ghost">STRONA GŁÓWNA</Link>}
      </div>
    </section>
  );
}