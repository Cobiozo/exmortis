import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { DEF_LIST, DEF_SPECIAL, DEF_TEXTS, pickThought } from "@/content/thoughts";
import ThoughtsList from "./ThoughtsList";
import SpecialDates from "./SpecialDates";

const H = "technical text-[10px] gold-text mb-3";
const TEXTS = [["rano", "Rano (5:00–10:59)"], ["noc", "Noc (23:00–4:59) — {Obok} = link do zakładki"], ["tel", "Noc — linia z numerem 116 123"]];

// Treści stron → Myśli dnia. Zapis do page_content, strona „mysli”.
export default function ThoughtsEditor() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    base44.functions.invoke("adminContent", { action: "list" }).then((r) => {
      const m = Object.fromEntries((r.data.content || []).filter((x) => x.page_key === "mysli").map((x) => [x.block_key, x.value]));
      setD({ lista: m.lista || DEF_LIST, specjalne: m.specjalne || DEF_SPECIAL, ...DEF_TEXTS, ...Object.fromEntries(TEXTS.map(([k]) => [k, m[k] ?? DEF_TEXTS[k]])) });
    });
  }, []);
  if (!d) return <Loader2 className="h-6 w-6 animate-spin text-[#C9A24A]" />;

  const up = (patch) => { setD({ ...d, ...patch }); setMsg(""); };
  const save = async () => {
    setBusy(true);
    const lista = d.lista.filter((x) => x.t.trim()), specjalne = d.specjalne.filter((x) => /^\d{2}-\d{2}$/.test(x.d) && x.t.trim());
    await Promise.all([["lista", lista], ["specjalne", specjalne], ...TEXTS.map(([k]) => [k, d[k]])].map(([key, value]) =>
      base44.functions.invoke("adminContent", { action: "save", page: "mysli", key, value })));
    setBusy(false); setMsg("Zapisano. Na stronie widać po odświeżeniu.");
  };
  const today = new Date(), tomorrow = new Date(Date.now() + 86400000);

  return (
    <div className="space-y-10 max-w-4xl">
      <div className="border hairline p-5 space-y-2">
        <p className="text-sm"><span className="gold-text technical text-[10px] mr-2">DZIŚ:</span>{pickThought(today, d.lista, d.specjalne) || "—"}</p>
        <p className="text-sm"><span className="gold-text technical text-[10px] mr-2">JUTRO:</span>{pickThought(tomorrow, d.lista, d.specjalne) || "—"}</p>
      </div>
      <section><p className={H}>MYŚLI DNIA — KOLEJNO WG DNIA ROKU</p><ThoughtsList items={d.lista} onChange={(lista) => up({ lista })} /></section>
      <section><p className={H}>DATY SPECJALNE — MAJĄ PIERWSZEŃSTWO</p><SpecialDates items={d.specjalne} onChange={(specjalne) => up({ specjalne })} /></section>
      <section className="space-y-4"><p className={H}>PORY DNIA</p>
        {TEXTS.map(([k, l]) => (
          <label key={k} className="block"><span className="text-xs text-foreground/60">{l}</span>
            <input value={d[k]} onChange={(e) => up({ [k]: e.target.value })} className="mt-1 w-full min-h-[40px] bg-transparent border border-[#3D3D3F] px-3 text-sm focus:border-[#C9A24A] outline-none" />
          </label>
        ))}
      </section>
      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={busy} className="btn-relic">{busy && <Loader2 className="h-4 w-4 animate-spin" />} ZAPISZ</button>
        {msg && <span className="text-sm gold-text">{msg}</span>}
      </div>
    </div>
  );
}