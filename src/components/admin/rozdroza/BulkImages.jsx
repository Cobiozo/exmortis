import React, { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Square, Check, X, CornerLeftUp, Copy } from "lucide-react";
import { rz, thumb, composePrompt } from "./rzApi";

const btn = "inline-flex items-center gap-1.5 border hairline px-3 py-2 technical text-[9px] text-foreground/70 hover:text-[#C9A24A] hover:border-[#C9A24A] disabled:opacity-40";
// Błędy, po których nie ma sensu generować kolejnych kadrów (brak środków, klucz, weryfikacja).
const FATAL = /kredyt|środk|klucz|weryfikac|niedostępny dla tego klucza|wybrano openai/i;

// Grafiki historii wg pakietu: na start 2 okładki + sceny 01, 02, 05, 07, 11, 15, 17; reszta — obraz z poprzedniej sceny albo gradient.
// Każdy wygenerowany kadr czeka na zatwierdzenie (nie podmienia zatwierdzonego zdjęcia).
export default function BulkImages({ id, story, scenes, onChanged }) {
  const [ai, setAi] = useState(null);
  const [run, setRun] = useState(null); // { done, total, current, errors: [] }
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const stop = useRef(false);
  useEffect(() => { rz("ai_get").then(setAi).catch(() => setAi(null)); }, []);

  const targets = [
    ...[["cover_portrait", "okładka 2:3", story.cover_portrait_url, story.cover_portrait_candidate, story.cover_portrait_prompt],
      ["cover_landscape", "okładka 16:9", story.cover_landscape_url, story.cover_landscape_candidate, story.cover_landscape_prompt]]
      .filter(([, , url, cand, p]) => !url && !cand && String(p || "").trim())
      .map(([kind, label]) => ({ kind, id, label })),
    ...scenes.filter((s) => !s.image_url && !s.image_candidate_url && String(s.image_prompt || "").trim())
      .map((s) => ({ kind: "scene", id: s.id, label: s.scene_key })),
  ];
  const pending = [
    ...(story.cover_portrait_candidate ? [{ kind: "cover_portrait", id, label: "Okładka 2:3", url: story.cover_portrait_candidate, has: !!story.cover_portrait_url }] : []),
    ...(story.cover_landscape_candidate ? [{ kind: "cover_landscape", id, label: "Okładka 16:9", url: story.cover_landscape_candidate, has: !!story.cover_landscape_url }] : []),
    ...scenes.filter((s) => s.image_candidate_url).map((s) => ({ kind: "scene", id: s.id, label: `${s.scene_key} · ${s.title || ""}`, url: s.image_candidate_url, has: !!s.image_url })),
  ];
  const noImage = scenes.filter((s) => !s.image_url).length;
  const [count, setCount] = useState(9);
  const n = Math.max(1, Math.min(count || 1, targets.length));
  // Najpierw okładki, potem sceny rozłożone równomiernie — reszta dostaje obraz z najbliższej poprzedniej sceny.
  const pick = () => {
    const covers = targets.filter((t) => t.kind !== "scene").slice(0, n);
    const sc = targets.filter((t) => t.kind === "scene");
    const k = Math.min(n - covers.length, sc.length);
    const chosen = k <= 0 ? [] : Array.from({ length: k }, (_, i) => sc[Math.floor((i * sc.length) / k)]);
    return [...covers, ...chosen];
  };

  const generateAll = async () => {
    setConfirm(false); setMsg(""); stop.current = false;
    const list = pick();
    const st = { done: 0, total: list.length, current: "", errors: [] };
    setRun({ ...st });
    for (const t of list) {
      if (stop.current) break;
      st.current = t.label; setRun({ ...st });
      try { await rz("generate", { kind: t.kind, id: t.id }); onChanged?.(); } // kadr od razu w „Czekają na zatwierdzenie”
      catch (e) {
        st.errors.push(`${t.label}: ${e.message}`);
        if (FATAL.test(e.message)) { st.done++; setRun({ ...st }); break; }
      }
      st.done++; setRun({ ...st });
    }
    st.current = ""; setRun({ ...st, finished: true });
    await onChanged?.();
  };

  const fill = async () => {
    setBusy("fill"); setMsg("");
    try {
      const r = await rz("fill_previous", { id });
      setMsg(r.filled.length
        ? `Uzupełniono ${r.filled.length} scen obrazem z poprzedniej sceny.${r.missing.length ? ` Bez obrazu (elegancki gradient): ${r.missing.join(", ")}.` : ""}`
        : `Nic do uzupełnienia — najpierw zatwierdź kadry startowe.${r.missing.length ? ` Bez obrazu: ${r.missing.join(", ")}.` : ""}`);
      await onChanged?.();
    } catch (e) { setMsg(e.message); }
    setBusy("");
  };

  const decide = async (t, decision) => {
    setBusy(`${t.kind}:${t.id}`);
    try { await rz("candidate", { kind: t.kind, id: t.id, decision }); await onChanged?.(); } catch (e) { setMsg(e.message); }
    setBusy("");
  };

  // Lista promptów startowych do jednej rozmowy w ChatGPT (subskrypcja): kolejne obrazy w tym samym wątku trzymają te same postacie.
  const [copied, setCopied] = useState(false);
  const copyAll = async () => {
    const items = [
      ["Okładka pionowa 2:3", composePrompt("cover_portrait", story.cover_portrait_prompt, story), story.cover_portrait_prompt],
      ["Okładka pozioma 16:9", composePrompt("cover_landscape", story.cover_landscape_prompt, story), story.cover_landscape_prompt],
      ...scenes.map((s) => [`Scena ${s.scene_key} (16:9)`, composePrompt("scene", s.image_prompt, story), s.image_prompt]),
    ].filter(([, , base]) => String(base || "").trim());
    const text = `Wygeneruj po kolei ${items.length} obrazów do historii „${story.title}”. Jeden obraz na odpowiedź — po każdym poczekaj, aż napiszę „dalej”. We wszystkich obrazach zachowaj te same postacie (twarze, wiek, fryzury, stroje). Żadnego tekstu na obrazach.\n\n`
      + items.map(([label, p], i) => `${i + 1}) ${label}:\n${p}`).join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setMsg("Nie udało się skopiować — użyj „Kopiuj prompt” przy każdej scenie."); }
  };

  const running = run && !run.finished;
  const provider = ai?.provider === "openai" ? `OpenAI (${ai.model}, jakość ${ai.quality}${String(story.reference_image_url || "").trim() ? ", ze wzorem postaci" : ""})` : "Base44 AI (kredyty aplikacji)";

  return (
    <section className="border hairline p-5 space-y-4">
      <h3 className="shop-heading text-xl text-[#F5EFE1]">Grafiki historii</h3>
      <p className="text-sm text-foreground/60 leading-relaxed max-w-3xl">
        Na start generujemy 2 okładki i sceny 01, 02, 05, 07, 11, 15, 17. Pozostałe sceny dostają obraz z poprzedniej sceny albo zostają z gradientem, a ich własne prompty zostają do późniejszego generowania.
        Każdy kadr czeka na Twoje zatwierdzenie. Generuje: <span className="text-foreground/85">{ai ? provider : "…"}</span>.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {!running && !confirm && targets.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-foreground/60">Ile kadrów:
            <input type="number" min={1} max={targets.length} value={count} onChange={(e) => setCount(Number(e.target.value))}
              className="w-16 bg-transparent border hairline px-2 py-1 text-foreground" />
            <span className="flex gap-1">{[3, 6, 9, targets.length].filter((v, i, a) => v <= targets.length && a.indexOf(v) === i).map((v) => (
              <button key={v} type="button" onClick={() => setCount(v)} className={`border hairline px-2 py-1 technical text-[9px] ${n === v ? "text-[#C9A24A] border-[#C9A24A]" : ""}`}>{v === targets.length ? `WSZYSTKIE ${v}` : v}</button>
            ))}</span>
          </label>
        )}
        {!running && !confirm && (
          <button type="button" className="btn-relic !px-4 !py-2 text-[10px] disabled:opacity-40" disabled={!targets.length || !!busy} onClick={() => setConfirm(true)}>
            <Sparkles className="h-4 w-4" /> GENERUJ {n} Z {targets.length}
          </button>
        )}
        {confirm && (
          <span className="flex flex-wrap items-center gap-2 border border-[#E8C547]/60 p-2">
            <span className="text-xs text-[#E8C547]">{n} generowań ({ai?.provider === "openai" ? "płatne z konta OpenAI" : "z kredytów AI Base44"}). Potwierdzasz?</span>
            <button type="button" className="btn-relic !px-3 !py-1.5 text-[10px]" onClick={generateAll}>TAK, GENERUJ</button>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-[10px]" onClick={() => setConfirm(false)}>ANULUJ</button>
          </span>
        )}
        {running && (
          <button type="button" className={btn} onClick={() => { stop.current = true; }}><Square className="h-3.5 w-3.5" /> ZATRZYMAJ PO BIEŻĄCYM</button>
        )}
        <button type="button" className={btn} disabled={running || !!busy || !noImage} onClick={fill}>
          {busy === "fill" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerLeftUp className="h-3.5 w-3.5" />} UZUPEŁNIJ RESZTĘ Z POPRZEDNICH SCEN
        </button>
        <button type="button" className={btn} onClick={copyAll}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "SKOPIOWANO" : "KOPIUJ PROMPTY STARTOWE (DO CHATGPT)"}</button>
      </div>
      {run && (
        <div className="text-sm space-y-1" role="status" aria-live="polite">
          <p className="text-foreground/75">
            {running ? <><Loader2 className="inline h-3.5 w-3.5 animate-spin mr-2" />{run.done + 1}/{run.total}: {run.current} (do 2 minut na kadr)…</> : `Zakończono: ${run.done}/${run.total}.`}
          </p>
          {run.errors.length > 0 && <ul className="text-xs text-[#E8676A] list-disc pl-5">{run.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </div>
      )}
      {msg && <p className="text-sm text-foreground/75" role="status">{msg}</p>}
      {pending.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="technical text-[10px] gold-text">CZEKAJĄ NA ZATWIERDZENIE ({pending.length})</p>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((t) => (
              <li key={`${t.kind}:${t.id}`} className="border hairline p-2 space-y-2">
                <img src={thumb(t.url, 960)} alt="" loading="lazy" className={`w-full object-cover bg-[#141416] ${t.kind === "cover_portrait" ? "aspect-[2/3]" : "aspect-video"}`} />
                <p className="text-xs text-foreground/70 truncate">{t.label}{t.has && <span className="text-[#E8C547]"> · zastąpi obecne</span>}</p>
                <div className="flex gap-2">
                  <button type="button" className="btn-relic !px-3 !py-1.5 text-[10px]" disabled={!!busy || running} onClick={() => decide(t, "accept")}>
                    {busy === `${t.kind}:${t.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} ZATWIERDŹ</button>
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-[10px]" disabled={!!busy || running} onClick={() => decide(t, "reject")}><X className="h-3.5 w-3.5" /> ODRZUĆ</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}