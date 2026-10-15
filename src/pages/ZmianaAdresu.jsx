import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNoIndex } from "@/lib/useNoIndex";

const inp = "w-full bg-transparent border hairline px-4 py-3 focus:border-[#C9A24A] focus:outline-none";
const call = (p) => base44.functions.invoke("emailChange", p).then((r) => r.data).catch((e) => ({ error: e?.response?.data?.error || "Coś poszło nie tak." }));

// Strona z jednorazowego linku: nowy adres wpisany dwa razy.
export default function ZmianaAdresu() {
  useNoIndex();
  const t = new URLSearchParams(window.location.search).get("t") || "";
  const [state, setState] = useState("check");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { call({ action: "check", t }).then((r) => setState(r.ok ? "form" : "invalid")); }, [t]);

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (a.trim().toLowerCase() !== b.trim().toLowerCase()) return setErr("Adresy nie są takie same.");
    setState("busy");
    const r = await call({ action: "submit", t, email1: a, email2: b });
    if (r.ok) setState("done"); else { setErr(r.error); setState("form"); }
  };

  return (
    <div className="min-h-[80vh] pt-32 pb-20 px-5">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="relic-heading text-3xl">Nowy adres e-mail</h1>
        {state === "check" && <Loader2 className="h-5 w-5 animate-spin gold-text" />}
        {state === "invalid" && <p className="text-foreground/60">Link wygasł albo został już użyty.</p>}
        {state === "done" && <p className="text-foreground/70">Gotowe. Na nowy adres wysłałem zaproszenie. Przyjmij je, aby dokończyć zmianę.</p>}
        {(state === "form" || state === "busy") && (
          <form onSubmit={submit} className="space-y-4">
            <input type="email" required value={a} onChange={(e) => setA(e.target.value)} placeholder="nowy adres e-mail" className={inp} />
            <input type="email" required value={b} onChange={(e) => setB(e.target.value)} placeholder="powtórz nowy adres" className={inp} />
            {err && <p role="alert" className="text-sm blood-text">{err}</p>}
            <button disabled={state === "busy"} className="btn-relic w-full">{state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />} ZATWIERDŹ</button>
          </form>
        )}
      </div>
    </div>
  );
}