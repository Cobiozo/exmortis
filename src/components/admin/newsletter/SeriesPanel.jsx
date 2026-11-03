import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, X, Pencil, Eye, Smartphone, Monitor, FlaskConical, ArrowUp, ArrowDown } from "lucide-react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import useMailStatus, { MAIL_REQUIRED } from "@/lib/useMailStatus";

// Seria startowa „Listy powrotu — początek drogi”: każda nowa osoba dostaje listy po kolei,
// co poniedziałek o 8:00 (list 1 — w pierwszy poniedziałek po dniu zapisu). Potem — bieżące kampanie.

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";
const errText = (err, fallback) => err?.response?.data?.error || (err?.message && !/^Request failed|^Funkcja \w+: \d+$/.test(err.message) ? err.message : "") || fallback;
const fixUrl = (u) => {
  const v = String(u || "").trim();
  if (!v) return "";
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return "https://" + v.slice(7);
  return /^[a-z]+:/i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
};
const plWhen = (iso) => new Date(iso).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
const api = (action, extra = {}) => base44.functions.invoke("adminNewsletter", { action, ...extra }).then((r) => r.data);
const payload = (e) => {
  const buttons = (e.buttons || []).filter((b) => b.label.trim() || b.url.trim()).map((b) => ({ label: b.label.trim(), url: fixUrl(b.url) }));
  return { subject: e.subject, content: e.content, preheader: e.preheader, buttons, cta_label: buttons[0]?.label || "", cta_url: buttons[0]?.url || "" };
};

export default function SeriesPanel() {
  const { ready: mailOk } = useMailStatus();
  const [state, setState] = useState(null);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [preview, setPreview] = useState(null);

  const load = () => api("series.get").then(setState).catch((e) => setError(errText(e, "Nie udało się wczytać serii.")));
  useEffect(() => { load(); }, []);

  const run = async (fn, fallback) => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(errText(e, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const open = (l) => setEditor(l
    ? { id: l.id, position: l.position, subject: l.subject || "", preheader: l.preheader || "", content: l.content || "",
        buttons: Array.isArray(l.buttons) && l.buttons.length ? l.buttons.map((b) => ({ label: b.label || "", url: b.url || "" })) : [{ label: "", url: "" }] }
    : { id: null, position: (state?.letters?.length || 0) + 1, subject: "", preheader: "", content: "", buttons: [{ label: "", url: "" }] });

  const save = () => run(async () => {
    if (!editor.subject.trim()) throw new Error("Podaj temat listu.");
    const d = await api("series.saveLetter", { id: editor.id, ...payload(editor) });
    setState(d);
    setEditor({ ...editor, id: d.id });
    setInfo("Zapisano. Osoby, które jeszcze nie dostały tego listu, dostaną tę wersję.");
  }, "Nie udało się zapisać.");

  const showPreview = () => run(async () => {
    const d = await api("campaigns.preview", payload(editor));
    setPreview({ html: d.html, w: 390 });
  }, "Nie udało się przygotować podglądu.");

  const sendTest = () => run(async () => {
    const d = await api("campaigns.test", payload(editor));
    setInfo(`Wysłano list testowy na ${d.to}.`);
  }, "Nie udało się wysłać testu.");

  const toggle = (on) => {
    const s = state;
    const msg = on
      ? `Włączyć serię „${s.series.name}”?\n\nOsoby zapisane (${s.stats.bez_serii + s.stats.w_trakcie}) dostaną list 1 w najbliższy poniedziałek o 8:00${s.pierwszy_poniedzialek ? ` (${plWhen(s.pierwszy_poniedzialek)})` : ""}, a potem kolejne co tydzień. Do czasu ukończenia serii nie dostaną bieżących kampanii.`
      : "Wyłączyć serię? Wysyłka listów serii zatrzyma się (postęp osób zostaje), a bieżące kampanie znów trafią do wszystkich.";
    if (!window.confirm(msg)) return;
    run(async () => {
      const d = await api("series.setActive", { on });
      setState(d);
      setInfo(on ? "Seria włączona." : "Seria wyłączona.");
    }, "Nie udało się zmienić stanu serii.");
  };

  if (!state) {
    return error ? <p className="text-sm blood-text">{error}</p> : <div className="h-24 border hairline animate-pulse bg-[#0F0F10]" />;
  }

  // ===== EDYTOR LISTU =====
  if (editor) {
    return (
      <div className="border hairline p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="relic-heading text-xl">LIST {editor.position} · {state.series.name.toUpperCase()}</h3>
          <button onClick={() => { setEditor(null); setInfo(""); setError(""); }} className="text-foreground/40 hover:text-foreground p-2" aria-label="Zamknij"><X className="h-5 w-5" /></button>
        </div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">TEMAT</label>
        <input value={editor.subject} onChange={(e) => setEditor({ ...editor, subject: e.target.value })} className={`${inputCls} mb-1`} maxLength={300} />
        <p className={`text-[11px] mb-4 ${editor.subject.length > 60 ? "text-[#E8676A]" : "text-foreground/40"}`}>{editor.subject.length}/60</p>
        <label className="technical text-[10px] text-foreground/50 block mb-2">ZAJAWKA (WIDOCZNA W SKRZYNCE OBOK TEMATU)</label>
        <input value={editor.preheader} onChange={(e) => setEditor({ ...editor, preheader: e.target.value })} className={`${inputCls} mb-4`} maxLength={140} />
        <RichTextEditor value={editor.content} onChange={(v) => setEditor({ ...editor, content: v })} placeholder="Treść listu…" />
        {editor.buttons.map((b, i) => {
          const setB = (patch) => setEditor({ ...editor, buttons: editor.buttons.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mt-4 items-end">
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-2">{i === 0 ? "PRZYCISK GŁÓWNY (ZŁOTY) — TEKST" : `PRZYCISK ${i + 1} (OBRYS) — TEKST`}</label>
                <input value={b.label} onChange={(e) => setB({ label: e.target.value })} className={inputCls} maxLength={60} />
              </div>
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-2">LINK</label>
                <input value={b.url} onChange={(e) => setB({ url: e.target.value })} className={inputCls} placeholder="exmortis.pl/test" />
              </div>
              <button type="button" onClick={() => setEditor({ ...editor, buttons: editor.buttons.length > 1 ? editor.buttons.filter((_, j) => j !== i) : [{ label: "", url: "" }] })}
                className="text-foreground/40 hover:blood-text p-2.5" aria-label={`Usuń przycisk ${i + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
        {editor.buttons.length < 3 && (
          <button type="button" onClick={() => setEditor({ ...editor, buttons: [...editor.buttons, { label: "", url: "" }] })}
            className="technical text-[10px] gold-text mt-3 inline-flex items-center gap-1 hover:underline underline-offset-4"><Plus className="h-3 w-3" /> DODAJ PRZYCISK</button>
        )}
        {info && <p className="text-sm gold-text mt-4">{info}</p>}
        {error && <p className="text-sm blood-text mt-4">{error}</p>}
        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={save} disabled={busy} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">ZAPISZ LIST</button>
          <button onClick={showPreview} disabled={busy} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60"><Eye className="h-4 w-4" /> PODGLĄD</button>
          <button onClick={sendTest} disabled={busy || !mailOk} title={mailOk ? undefined : MAIL_REQUIRED} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60"><FlaskConical className="h-4 w-4" /> WYŚLIJ TEST DO MNIE</button>
        </div>
        {preview && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center p-4 overflow-auto" role="dialog" aria-modal="true" aria-label="Podgląd listu">
            <div className="flex gap-2 mb-3">
              <button onClick={() => setPreview({ ...preview, w: 390 })} className={`btn-ghost !px-4 !py-2 ${preview.w === 390 ? "!border-[#C9A24A]" : ""}`}><Smartphone className="h-4 w-4" /> TELEFON</button>
              <button onClick={() => setPreview({ ...preview, w: 720 })} className={`btn-ghost !px-4 !py-2 ${preview.w === 720 ? "!border-[#C9A24A]" : ""}`}><Monitor className="h-4 w-4" /> KOMPUTER</button>
              <button onClick={() => setPreview(null)} className="btn-ghost !px-4 !py-2" aria-label="Zamknij podgląd"><X className="h-4 w-4" /></button>
            </div>
            <iframe title="Podgląd listu" srcDoc={preview.html} sandbox="" style={{ width: preview.w, maxWidth: "100%" }} className="h-[80vh] bg-white border-0" />
          </div>
        )}
      </div>
    );
  }

  // ===== PRZEGLĄD SERII =====
  const { series, letters, stats } = state;
  const onLetter = new Map(stats.na_liscie.map((r) => [r.pozycja, r.osoby]));
  return (
    <div>
      <div className="border hairline p-5 md:p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="technical text-[10px] gold-text mb-2">SERIA STARTOWA</p>
            <h3 className="relic-heading text-2xl text-[#F5EFE1]">{series.name}</h3>
            <p className="text-sm text-foreground/60 mt-2 max-w-[640px]">
              Każda nowa osoba po zapisie dostaje tylko potwierdzenie. List 1 — w pierwszy poniedziałek po dniu zapisu, o 8:00; kolejne co poniedziałek.
              W trakcie serii osoba nie dostaje bieżących kampanii; po ostatnim liście — dostaje bieżące.
            </p>
          </div>
          <span className={`technical text-[10px] px-3 py-1.5 border whitespace-nowrap ${series.active ? "border-[#C9A24A] gold-text" : "hairline text-foreground/50"}`}>
            {series.active ? "AKTYWNA" : "WYŁĄCZONA"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-sm">
          <div><p className="technical text-[9px] text-foreground/40">W TRAKCIE</p><p className="text-lg">{stats.w_trakcie}</p></div>
          <div><p className="technical text-[9px] text-foreground/40">UKOŃCZYLI</p><p className="text-lg">{stats.ukonczyli}</p></div>
          <div><p className="technical text-[9px] text-foreground/40">{series.active ? "DOŁĄCZĄ PRZY NAJBLIŻSZYM PRZEBIEGU" : "ZACZNĄ PO WŁĄCZENIU"}</p><p className="text-lg">{stats.bez_serii}</p></div>
          <div><p className="technical text-[9px] text-foreground/40">NAJBLIŻSZA WYSYŁKA</p><p className="text-sm">{series.active && stats.najblizsza ? plWhen(stats.najblizsza) : series.active ? "—" : state.pierwszy_poniedzialek ? `po włączeniu: ${plWhen(state.pierwszy_poniedzialek)}` : "—"}</p></div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          {series.active
            ? <button onClick={() => toggle(false)} disabled={busy} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60">WYŁĄCZ SERIĘ</button>
            : <button onClick={() => toggle(true)} disabled={busy || !mailOk || !letters.length} title={!letters.length ? "Najpierw dodaj listy" : undefined} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">WŁĄCZ SERIĘ</button>}
        </div>
        {info && <p className="text-sm gold-text mt-3">{info}</p>}
        {error && <p className="text-sm blood-text mt-3">{error}</p>}
      </div>

      <div className="border hairline divide-y divide-[#3D3D3F]/40">
        {letters.length === 0 && <p className="text-foreground/50 p-8 text-center">Seria nie ma jeszcze listów. Dodaj pierwszy — planowo jest ich osiem.</p>}
        {letters.map((l, i) => (
          <div key={l.id} className="flex items-center gap-3 p-3 hover:bg-[#0F0F10] transition-colors">
            <span className="technical text-[10px] gold-text w-8 shrink-0">{String(l.position).padStart(2, "0")}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{l.subject || "Bez tematu"}</p>
              <p className="text-xs text-foreground/40 truncate">
                {onLetter.get(Number(l.position)) ? `${onLetter.get(Number(l.position))} os. czeka na ten list · ` : ""}
                zmieniony {new Date(l.updated_date).toLocaleDateString("pl-PL")}
              </p>
            </div>
            <button onClick={() => run(async () => setState(await api("series.moveLetter", { id: l.id, dir: -1 })), "Nie udało się przesunąć.")} disabled={busy || i === 0} className="p-2 text-foreground/40 hover:gold-text disabled:opacity-20" aria-label="W górę"><ArrowUp className="h-4 w-4" /></button>
            <button onClick={() => run(async () => setState(await api("series.moveLetter", { id: l.id, dir: 1 })), "Nie udało się przesunąć.")} disabled={busy || i === letters.length - 1} className="p-2 text-foreground/40 hover:gold-text disabled:opacity-20" aria-label="W dół"><ArrowDown className="h-4 w-4" /></button>
            <button onClick={() => open(l)} className="p-2 text-foreground/50 hover:gold-text" aria-label="Edytuj"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => { if (window.confirm(`Usunąć list ${l.position} „${l.subject}”?`)) run(async () => setState(await api("series.deleteLetter", { id: l.id })), "Nie udało się usunąć."); }}
              disabled={busy || series.active} title={series.active ? "Wyłącz serię, żeby usunąć list" : undefined} className="p-2 text-foreground/40 hover:blood-text disabled:opacity-20" aria-label="Usuń"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => open(null)} disabled={busy} className="btn-ghost !px-5 !py-2.5 mt-4 disabled:opacity-60"><Plus className="h-4 w-4" /> DODAJ LIST {letters.length + 1}</button>
    </div>
  );
}
