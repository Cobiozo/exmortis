import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Check, Loader2, Search, X } from "lucide-react";
import { unitPrice, zl } from "@/lib/productPrice";

const DIGITAL = ["pdf", "audio", "wideo", "kurs"];
const TYPE_LABEL = { pdf: "PDF", audio: "Audio", wideo: "Wideo", kurs: "Kurs wideo" };
const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";

// Składniki pakietu: wybór z produktów cyfrowych + podgląd wartości i oszczędności.
export default function BundleItemsPicker({ form, set }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    base44.functions
      .invoke("adminProducts", { action: "list" })
      .then((r) => setProducts(r.data.products || []))
      .catch(() => setProducts([]));
  }, []);

  const chosen = Array.isArray(form.bundle_items) ? form.bundle_items.map(String) : [];
  const byId = useMemo(() => new Map((products || []).map((p) => [String(p.id), p])), [products]);
  const options = (products || []).filter(
    (p) => DIGITAL.includes(p.product_type) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))
  );

  const chosenRows = chosen.map((id) => byId.get(id)).filter(Boolean);
  const separately = chosenRows.reduce((s, p) => s + unitPrice(p), 0);
  const pkg = unitPrice({ price: form.price, price_regular: form.price_regular, price_start: form.price_start, promo_end_date: form.promo_end_date });
  const save = separately - pkg;
  const pct = separately > 0 ? Math.round((save / separately) * 100) : 0;

  const toggle = (id) => set("bundle_items", chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  return (
    <div className="mb-10">
      <p className="technical text-[10px] gold-text mb-4">SKŁADNIKI PAKIETU</p>
      <p className="text-xs text-foreground/50 mb-4">
        Wybierz od 2 do 10 produktów cyfrowych (PDF, audio, wideo, kurs). Cena pakietu to cena ustawiona wyżej —
        drabinka i Omnibus działają jak dla zwykłego produktu. Czas dostępu z pola wyżej obejmie wszystkie składniki.
      </p>
      {products === null ? (
        <p className="flex items-center gap-2 text-sm text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Ładuję produkty…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {chosen.length === 0 && <span className="text-xs text-foreground/40">Nie wybrano jeszcze żadnego produktu.</span>}
            {chosen.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="technical text-[9px] px-3 py-1.5 border border-[#C9A24A] gold-text bg-[#C9A24A]/10 inline-flex items-center gap-2"
              >
                {byId.get(id)?.name || "—"} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
          <label className="relative block mb-3">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj produktu…" className={`${inp} pl-9`} />
          </label>
          <div className="border hairline divide-y divide-[#3D3D3F]/40 max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="p-4 text-sm text-foreground/40">Brak produktów cyfrowych do wyboru.</p>
            ) : (
              options.map((p) => {
                const on = chosen.includes(String(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(String(p.id))}
                    className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${on ? "bg-[#C9A24A]/10" : "hover:bg-[#0F0F10]"}`}
                  >
                    <span className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center ${on ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B]" : "hairline"}`}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{p.name}</span>
                      <span className="block technical text-[9px] text-foreground/40 mt-0.5">
                        {(TYPE_LABEL[p.product_type] || p.product_type || "").toUpperCase()}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-foreground/60 whitespace-nowrap">{zl(unitPrice(p))}</span>
                  </button>
                );
              })
            )}
          </div>
          {chosenRows.length > 0 && (
            <p className="text-sm text-foreground/70 mt-4">
              Wartość osobno: <span className="font-mono">{zl(separately)}</span> · Pakiet:{" "}
              <span className="font-mono gold-text">{zl(pkg)}</span>
              {save > 0 && (
                <>
                  {" "}· Oszczędzasz <span className="gold-text font-mono">{zl(save)}</span> ({pct}%)
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}