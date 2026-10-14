import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { myLibrary, markCompleted, KIND } from "./libApi";
import LibraryTile from "./LibraryTile";
import MaterialSheet from "./MaterialSheet";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";
const ORDER = ["AUDIO", "WIDEO", "PDF", "TEKST", "LINK"];

const Grid = ({ items, onOpen, onToggleDone }) => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {items.map((i) => <LibraryTile key={i.id} item={i} onOpen={onOpen} onToggleDone={onToggleDone} />)}
  </div>
);

// „Moja biblioteka": kafelki, kolekcje w kolejności, filtry typu, wyszukiwarka przy większej liczbie.
export default function MyLibrary({ initial, onGoToOrders }) {
  const [data, setData] = useState(initial || null);
  const [err, setErr] = useState("");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  // Dane przyszły razem z wejściem na /konto — nie wołamy ich drugi raz.
  useEffect(() => { if (initial) return; myLibrary().then(setData).catch(() => setErr("Nie udało się wczytać biblioteki.")); }, [initial]);

  const items = (data && data.items) || [];
  const counts = (data && data.counts) || {};

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) =>
      (kind === "all" || i.kind === kind) &&
      (!needle || `${i.title} ${i.description || ""} ${i.note || ""}`.toLowerCase().includes(needle)));
  }, [items, kind, q]);

  const toggleDone = async (item) => {
    const next = !item.completed_at;
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, completed_at: next ? new Date().toISOString() : null } : x)) }));
    await markCompleted(item.id, next).catch(() => {});
  };

  const setOpened = (id) => setData((d) => ({
    ...d,
    items: d.items.map((x) => (x.id === id ? { ...x, opened_at: x.opened_at || new Date().toISOString() } : x)),
    unopened: Math.max(0, (d.unopened || 1) - 1),
  }));

  if (err) return <p className="font-body text-[15px] text-[#F5EFE1]/70 py-10">{err}</p>;
  if (!data) return (
    <div className="space-y-10" aria-busy="true" aria-label="Wczytywanie biblioteki">
      <div className="flex flex-wrap gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[44px] w-28 border hairline bg-foreground/5 animate-pulse" />)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border hairline p-6 space-y-4 animate-pulse">
            <div className="h-3 w-16 bg-foreground/10" />
            <div className="h-5 w-3/4 bg-foreground/10" />
            <div className="h-4 w-full bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  );

  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <p className="shop-heading text-2xl text-[#F5EFE1]">Tu jeszcze nic nie ma.</p>
        <p className="font-body text-[15px] leading-relaxed text-foreground/55 mt-4 max-w-[46ch] mx-auto">
          Gdy pojawi się materiał dla Ciebie, znajdziesz go dokładnie w tym miejscu. Nie musisz nic robić.
        </p>
      </div>
    );
  }

  const filtering = kind !== "all" || q.trim() !== "";
  const loose = items.filter((i) => !i.collection_id);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setKind("all")}
          className={`min-h-[44px] px-4 border font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${kind === "all" ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/55 hover:text-[#F5EFE1]"} ${FOCUS}`}>
          Wszystko ({items.length})
        </button>
        {ORDER.filter((k) => counts[k]).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`min-h-[44px] px-4 border font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${kind === k ? "border-[#C9A24A] text-[#C9A24A]" : "hairline text-foreground/55 hover:text-[#F5EFE1]"} ${FOCUS}`}>
            {KIND[k]} ({counts[k]})
          </button>
        ))}
        <button type="button" onClick={onGoToOrders}
          className={`ml-auto min-h-[44px] font-mono text-[11px] tracking-[0.14em] uppercase text-[#C9A24A] underline underline-offset-4 hover:text-[#E2C170] ${FOCUS}`}>
          Moje zakupy
        </button>
      </div>

      {items.length > 12 && (
        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/55" strokeWidth={1.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj w materiałach…"
            className="w-full min-h-[48px] pl-11 pr-4 bg-transparent border hairline font-body text-[16px] text-[#F5EFE1] placeholder:text-foreground/55 focus:outline-none focus:border-[#C9A24A]" />
        </label>
      )}

      {filtering ? (
        shown.length
          ? <Grid items={shown} onOpen={setOpen} onToggleDone={toggleDone} />
          : <p className="font-body text-[15px] text-foreground/55">Nic nie pasuje do tego szukania.</p>
      ) : (
        <>
          {(data.collections || []).map((c) => (
            <section key={c.id} className="space-y-5">
              <div>
                <h2 className="shop-heading text-2xl text-[#F5EFE1]">{c.title}</h2>
                {c.description && <p className="font-body text-[15px] leading-relaxed text-foreground/55 mt-2 max-w-[62ch]">{c.description}</p>}
              </div>
              <Grid items={c.items} onOpen={setOpen} onToggleDone={toggleDone} />
            </section>
          ))}
          {loose.length > 0 && (
            <section className="space-y-5">
              {!!(data.collections || []).length && <h2 className="shop-heading text-2xl text-[#F5EFE1]">Pozostałe materiały</h2>}
              <Grid items={loose} onOpen={setOpen} onToggleDone={toggleDone} />
            </section>
          )}
        </>
      )}

      {open && (
        <MaterialSheet material={open} completed={!!open.completed_at} onClose={() => setOpen(null)}
          onOpened={setOpened} />
      )}
    </div>
  );
}