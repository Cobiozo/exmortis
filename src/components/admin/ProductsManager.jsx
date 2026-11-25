import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Plus, Pencil, Trash2, Eye, EyeOff, Star, Search } from "lucide-react";
import ProductEditor from "./ProductEditor";
import WaitlistPanel from "./WaitlistPanel";
import ReviewsPanel from "./reviews/ReviewsPanel";

const LEVEL_NAMES = {
  0: "BRAMA",
  1: "PIERWSZY KROK",
  2: "PRAKTYKA",
  3: "KRĄG",
  4: "GŁĘBIA",
  5: "SPECJALNE",
};

// Porządek listy (25.11.2026): zakładki według tego, co klient widzi, a w „W sprzedaży” grupy.
const isSoon = (p) => (p.status || "dostępny") === "wkrótce";
const isHidden = (p) => !p.active || p.status === "ukryty";
const TABS = [
  ["sprzedaz", "W sprzedaży", (p) => !isHidden(p) && !isSoon(p)],
  ["zapowiedzi", "Zapowiedzi", (p) => !isHidden(p) && isSoon(p)],
  ["ukryte", "Ukryte", (p) => isHidden(p)],
  ["wszystkie", "Wszystkie", () => true],
];
const GROUPS = [
  ["platne", "Książki i materiały płatne", (p) => !p.is_free && !["usluga", "karta"].includes(p.product_type)],
  ["darmowe", "Bezpłatne", (p) => p.is_free && p.product_type !== "usluga"],
  ["uslugi", "Praca indywidualna i spotkania", (p) => p.product_type === "usluga"],
  ["karty", "Karty podarunkowe", (p) => p.product_type === "karta"],
];
const priceOf = (p) => (p.price_regular != null ? Number(p.price_regular) : Number(p.price) || 0);
const groupOf = (p) => (GROUPS.find(([, , m]) => m(p)) || GROUPS[0])[0];
const readTab = () => { try { return localStorage.getItem("exm_admin_products_tab") || "sprzedaz"; } catch { return "sprzedaz"; } };

export default function ProductsManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | produkt
  const [busy, setBusy] = useState(false);
  const [waitlist, setWaitlist] = useState(null);
  const [reviews, setReviews] = useState(false);
  const [pending, setPending] = useState(0);
  const [notice, setNotice] = useState(""); // np. „Powiadamiam N osób z listy oczekujących"
  const [tab, setTabState] = useState(readTab);
  const [q, setQ] = useState("");
  const setTab = (t) => { setTabState(t); try { localStorage.setItem("exm_admin_products_tab", t); } catch { /* bez pamięci */ } };
  const counts = useMemo(() => Object.fromEntries(TABS.map(([k, , m]) => [k, products.filter(m).length])), [products]);
  const visible = useMemo(() => {
    const m = (TABS.find(([k]) => k === tab) || TABS[0])[2];
    const s = q.trim().toLowerCase();
    return products.filter(m).filter((p) => !s || [p.name, p.slug, p.subtitle].some((x) => String(x || "").toLowerCase().includes(s)));
  }, [products, tab, q]);
  // W sprzedaży: grupy (płatne od najtańszych, bezpłatne, usługi, karty); pozostałe zakładki: jedna lista A–Z.
  const sections = useMemo(() => {
    if (tab !== "sprzedaz") return [[null, null, [...visible].sort((a, b) => String(a.name).localeCompare(String(b.name), "pl"))]];
    return GROUPS.map(([k, label]) => [k, label, visible.filter((p) => groupOf(p) === k)
      .sort((a, b) => priceOf(a) - priceOf(b) || String(a.name).localeCompare(String(b.name), "pl"))]).filter(([, , l]) => l.length);
  }, [visible, tab]);

  const load = () => {
    setLoading(true);
    base44.functions
      .invoke("adminProducts", { action: "list" })
      .then((res) => setProducts(res.data.products))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
    // Licznik opinii czekających na sprawdzenie (przycisk OPINIE).
    base44.functions
      .invoke("reviewsAdmin", { action: "counts" })
      .then((r) => setPending(r.data.counts?.oczekuje || 0))
      .catch(() => setPending(0));
  };
  useEffect(load, []);

  // Komunikat po premierze produktu gaśnie sam.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 12000);
    return () => clearTimeout(t);
  }, [notice]);

  if (reviews) return <ReviewsPanel onBack={() => { setReviews(false); load(); }} />;

  if (editing !== null) {
    return (
      <ProductEditor
        product={editing === "new" ? null : editing}
        onSaved={(data) => {
          setEditing(null);
          // Premiera „wkrótce” → „dostępny”: funkcja wysyła maile w tle i mówi, ile osób obejmuje.
          if (data?.waitlist_auto > 0) setNotice(`Powiadamiam ${data.waitlist_auto} osób z listy oczekujących`);
          load();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const toggleActive = async (p) => {
    setBusy(true);
    try {
      await base44.functions.invoke("adminProducts", {
        action: "save",
        product: { ...p, active: !p.active },
      });
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Usunąć produkt „${p.name}"? Tej operacji nie da się cofnąć.`)) return;
    setBusy(true);
    try {
      await base44.functions.invoke("adminProducts", { action: "delete", id: p.id });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <p className="technical text-[10px] text-foreground/40">
          {loading ? "ŁADUJĘ..." : `${products.length} PRODUKTÓW · ${counts.sprzedaz || 0} W SPRZEDAŻY`}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setReviews(true)}
            className={`technical text-[9px] px-4 py-3 border transition-colors inline-flex items-center gap-2 ${
              pending ? "border-[#C9A24A] gold-text bg-[#C9A24A]/10" : "hairline text-foreground/50 hover:text-foreground"
            }`}
            title="Opinie kupujących: moderacja i odpowiedzi"
          >
            <Star className="h-4 w-4" /> OPINIE{pending ? ` (${pending})` : ""}
          </button>
          <button onClick={() => setEditing("new")} className="btn-relic !px-5 !py-3">
            <Plus className="h-4 w-4" /> Nowy produkt
          </button>
        </div>
      </div>
      {notice && (
        <p className="text-xs gold-text border border-[#C9A24A]/40 bg-[#C9A24A]/10 px-4 py-3 mb-6">
          {notice}
        </p>
      )}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 border hairline animate-pulse bg-[#0F0F10]" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="text-foreground/50 border hairline p-10 text-center">
          Brak produktów. Dodaj pierwszy.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Widok produktów" className="flex flex-wrap gap-2">
              {TABS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`technical text-[10px] px-4 py-2.5 border transition-colors ${tab === k ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B]" : "hairline text-foreground/60 hover:text-foreground"}`}>
                  {label.toUpperCase()} <span className={tab === k ? "opacity-70" : "opacity-50"}>{counts[k] || 0}</span>
                </button>
              ))}
            </div>
            <label className="relative block lg:w-72">
              <span className="sr-only">Szukaj produktu</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj po nazwie"
                className="w-full bg-[#0F0F10] border hairline pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#C9A24A]/60" />
            </label>
          </div>
          {visible.length === 0 ? (
            <p className="text-foreground/50 border hairline p-8 text-center text-sm">
              {q ? "Nic nie pasuje do wyszukiwania." : tab === "zapowiedzi" ? "Brak zapowiedzi." : tab === "ukryte" ? "Nic nie jest ukryte." : "Brak produktów w tej zakładce."}
            </p>
          ) : (
            <div className="space-y-8">
              {sections.map(([k, label, list]) => (
                <section key={k || "lista"} aria-label={label || undefined}>
                  {label && (
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="technical text-[10px] gold-text">{label.toUpperCase()}</h3>
                      <span className="technical text-[9px] text-foreground/40">{list.length}</span>
                    </div>
                  )}
                  <div className="border hairline divide-y divide-[#3D3D3F]/40">
                    {list.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-[#0F0F10] transition-colors">
              <div className="w-14 h-14 border hairline flex-shrink-0 overflow-hidden bg-[#0F0F10]">
                {p.image_url && <Image src={p.image_url} className="w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  {isHidden(p) ? <span className="technical text-[8px] px-2 py-0.5 border hairline text-foreground/50 shrink-0">UKRYTY</span>
                    : isSoon(p) ? <span className="technical text-[8px] px-2 py-0.5 border border-[#C9A24A]/40 gold-text shrink-0">ZAPOWIEDŹ</span>
                    : <span className="technical text-[8px] px-2 py-0.5 border border-emerald-500/40 text-emerald-400 shrink-0">W SPRZEDAŻY</span>}
                </div>
                <p className="technical text-[9px] text-foreground/40 mt-1">
                  {LEVEL_NAMES[p.level] || "BEZ POZIOMU"} ·{" "}
                  {p.is_free
                    ? "BEZPŁATNE"
                    : p.price_regular != null
                    ? `${p.price_regular} ZŁ`
                    : p.price === 0
                    ? "BEZPŁATNE"
                    : `${p.price} ZŁ`}
                  {p.seats ? ` · ${p.seats.sold} / ${p.seats.capacity} MIEJSC` : ""}
                </p>
              </div>
              {p.waitlist_count > 0 && (
                <button onClick={() => setWaitlist(p)} className="technical text-[9px] px-3 py-2 border border-[#C9A24A]/40 gold-text hover:bg-[#C9A24A]/10 whitespace-nowrap" title="Lista oczekujących: podgląd, CSV, powiadomienie o premierze">
                  LISTA {p.waitlist_count}
                </button>
              )}
              <button
                onClick={() => toggleActive(p)}
                disabled={busy}
                title={p.active ? "Ukryj w sklepie" : "Pokaż w sklepie"}
                className={`technical text-[9px] px-3 py-2 border transition-colors ${
                  p.active
                    ? "border-[#C9A24A]/50 gold-text hover:bg-[#C9A24A]/10"
                    : "hairline text-foreground/40 hover:text-foreground"
                }`}
              >
                {p.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button onClick={() => setEditing(p)} className="text-foreground/50 hover:gold-text transition-colors p-2" aria-label="Edytuj">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(p)}
                disabled={busy}
                className="text-foreground/40 hover:blood-text transition-colors p-2"
                aria-label="Usuń"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {waitlist && <WaitlistPanel product={waitlist} onClose={() => { setWaitlist(null); load(); }} />}
    </div>
  );
}