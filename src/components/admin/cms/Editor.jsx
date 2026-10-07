import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { newBlock } from "@/components/cms/blockTypes";
import { validatePage } from "@/components/cms/validate";
import useHistory from "./useHistory";
import { publishPage } from "./publish";
import BlockList from "./BlockList";
import BlockForm from "./BlockForm";
import AddBlockDialog from "./AddBlockDialog";
import PreviewFrame from "./PreviewFrame";
import EditorTopBar from "./EditorTopBar";
import PublishReport from "./PublishReport";
import { tabBtn } from "./ui";

export default function Editor({ page, setPage, extra, onBack }) {
  const [blocks, setBlocks, undo, redo] = useHistory(page.bloki || []);
  const [sel, setSel] = useState(null);
  const [addAt, setAddAt] = useState(null);
  const [removed, setRemoved] = useState(null);
  const [save, setSave] = useState("zapisano");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pane, setPane] = useState("lista");
  const [scrollTo, setScrollTo] = useState(null);
  const first = useRef(true);
  const latest = useRef(blocks);
  latest.current = blocks;

  useEffect(() => { if (first.current) { first.current = false; return; } setSave("niezapisane"); }, [blocks]);
  const persist = async () => {
    setSave("zapisywanie");
    await base44.entities.SitePage.update(page.id, { bloki: latest.current, zmiany_niezapisane: true });
    setSave("zapisano");
  };
  useEffect(() => {
    if (save !== "niezapisane") return;
    const t = setTimeout(persist, 10000);
    return () => clearTimeout(t);
  }, [save, blocks]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = blocks.find((b) => b.id === sel);
  const select = (id) => { setSel(id); setPane("blok"); setScrollTo({ id }); };
  const update = (b) => setBlocks((bs) => bs.map((x) => (x.id === b.id ? b : x)));
  const move = (from, to) => setBlocks((bs) => { const a = [...bs]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; });
  const action = (a, i) => {
    if (a === "wyzej") move(i, i - 1);
    if (a === "nizej") move(i, i + 1);
    if (a === "duplikuj") setBlocks((bs) => { const c = structuredClone(bs[i]); c.id = crypto.randomUUID(); const n = [...bs]; n.splice(i + 1, 0, c); return n; });
    if (a === "usun") {
      const b = blocks[i];
      setBlocks((bs) => bs.filter((x) => x.id !== b.id));
      if (sel === b.id) setSel(null);
      setRemoved({ b, i });
      setTimeout(() => setRemoved((r) => (r?.b.id === b.id ? null : r)), 10000);
    }
  };
  const add = (typ) => { const b = newBlock(typ); setBlocks((bs) => { const n = [...bs]; n.splice(addAt, 0, b); return n; }); setAddAt(null); select(b.id); };

  const publish = async () => {
    const r = validatePage(blocks, extra.map(([p]) => p));
    setReport(r);
    if (r.errors.length) return;
    setBusy(true);
    const res = await publishPage(page, blocks);
    setPage({ ...page, ...res, bloki: blocks, status: "opublikowana" });
    setSave("zapisano");
    setReport({ ...r, ok: `Opublikowano wersję ${res.wersja}. Strona publiczna jest już zmieniona.` });
    setBusy(false);
  };

  const list = (
    <BlockList blocks={blocks} selectedId={sel} onSelect={select} onReorder={move} onAction={action} onAdd={setAddAt}
      onToggle={(id) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, widoczny: b.widoczny === false } : b)))} />
  );
  return (
    <div>
      <EditorTopBar page={page} save={save} busy={busy} onBack={onBack} onSave={persist} onPublish={publish} onUndo={undo} onRedo={redo} />
      <PublishReport report={report} onClose={() => setReport(null)} />
      {removed && (
        <div className="mb-4 flex items-center justify-between gap-4 border border-[#C9A24A]/50 px-4 py-3 text-sm">
          Usunięto blok. <button className="technical text-[10px] gold-text" onClick={() => { setBlocks((bs) => { const n = [...bs]; n.splice(removed.i, 0, removed.b); return n; }); setRemoved(null); }}>COFNIJ</button>
        </div>
      )}
      <div className="flex gap-2 mb-4 lg:hidden">
        {[["lista", "BLOKI"], ["blok", "EDYCJA"], ["podglad", "PODGLĄD"]].map(([k, l]) => <button key={k} className={tabBtn(pane === k)} onClick={() => setPane(k)}>{l}</button>)}
      </div>
      <div className="lg:grid lg:grid-cols-[280px_380px_minmax(0,1fr)] gap-6 items-start">
        <div className={`${pane === "lista" ? "" : "hidden"} lg:block lg:sticky lg:top-4 lg:max-h-[85vh] lg:overflow-y-auto`}>{list}</div>
        <div className={`${pane === "blok" ? "" : "hidden"} lg:block lg:sticky lg:top-4 lg:max-h-[85vh] lg:overflow-y-auto border hairline p-5`}>
          {selected ? <BlockForm key={selected.id} block={selected} onChange={update} onClose={() => { setSel(null); setPane("lista"); }} extra={extra} />
            : <p className="text-sm text-foreground/50">Wybierz blok z listy albo kliknij sekcję w podglądzie.</p>}
        </div>
        <div className={`${pane === "podglad" ? "" : "hidden"} lg:block`}>
          <PreviewFrame blocks={blocks} selectedId={sel} onSelect={select} scrollTo={scrollTo} />
        </div>
      </div>
      <AddBlockDialog open={addAt !== null} onOpenChange={(o) => !o && setAddAt(null)} onPick={add} />
    </div>
  );
}