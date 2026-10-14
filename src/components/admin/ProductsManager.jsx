import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Plus, Pencil, Trash2, Eye, EyeOff, Star } from "lucide-react";
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

export default function ProductsManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | produkt
  const [busy, setBusy] = useState(false);
  const [waitlist, setWaitlist] = useState(null);
  const [reviews, setReviews] = useState(false);
  const [pending, setPending] = useState(0);

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

  if (reviews) return <ReviewsPanel onBack={() => { setReviews(false); load(); }} />;

  if (editing !== null) {
    return (
      <ProductEditor
        product={editing === "new" ? null : editing}
        onSaved={() => {
          setEditing(null);
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
          {loading ? "ŁADUJĘ..." : `${products.length} PRODUKTÓW`}
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
            <Plus className="h-4 w-4" /> NOWY PRODUKT
          </button>
        </div>
      </div>
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
        <div className="border hairline divide-y divide-[#3D3D3F]/40">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-[#0F0F10] transition-colors">
              <div className="w-14 h-14 border hairline flex-shrink-0 overflow-hidden bg-[#0F0F10]">
                {p.image_url && <Image src={p.image_url} className="w-full h-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{p.name}</p>
                <p className="technical text-[9px] text-foreground/40 mt-1">
                  {LEVEL_NAMES[p.level] || "BEZ POZIOMU"} · {(p.status || "dostępny").toUpperCase()} ·{" "}
                  {p.is_free
                    ? "BEZPŁATNE"
                    : p.price_regular != null
                    ? `${p.price_regular} ZŁ`
                    : p.price === 0
                    ? "BEZPŁATNE"
                    : `${p.price} ZŁ`}
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
      )}
      {waitlist && <WaitlistPanel product={waitlist} onClose={() => { setWaitlist(null); load(); }} />}
    </div>
  );
}