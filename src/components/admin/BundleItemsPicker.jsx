import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Check, ImagePlus, Loader2, Search, X } from "lucide-react";
import { unitPrice, zl } from "@/lib/productPrice";
import { makeBundleCover } from "@/lib/bundleCover";

const DIGITAL = ["pdf", "audio", "wideo", "kurs", "zestaw"];
const TYPE_LABEL = { pdf: "PDF", audio: "Audio", wideo: "Wideo", kurs: "Kurs wideo", zestaw: "Ebook + nagrania" };
const inp = "w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";
const lbl = "technical text-[10px] text-foreground/50 block mb-2";

// Produkt w sprzedaży = aktywny i „dostępny” (tylko takie mogą wejść do pakietu — decyzja 26.11.2026).
export const onSale = (p) => p && p.active !== false && (p.status || "dostępny") === "dostępny";
const offLabel = (p) => (p.active === false || p.status === "ukryty" ? "UKRYTY" : p.status === "wkrótce" ? "ZAPOWIEDŹ" : "");
const pkgPrice = (form) =>
  unitPrice({ price: form.price, price_regular: form.price_regular === "" ? null : form.price_regular, price_start: form.price_start === "" ? null : form.price_start, promo_end_date: form.promo_end_date });

// Składniki pakietu: wybór z produktów w sprzedaży, cena z rabatu %, „bez kodów”, okładka z okładek produktów.
export default function BundleItemsPicker({ form, set, onProducts }) {
  const [products, setProducts] = useState(null);
  const [q, setQ] = useState("");
  const [pct, setPct] = useState("20");
  const [cover, setCover] = useState({ busy: false, msg: "" });

  useEffect(() => {
    base44.functions
      .invoke("adminProducts", { action: "list" })
      .then((r) => {
        const list = r.data.products || [];
        setProducts(list);
        onProducts?.(list);
      })
      .catch(() => setProducts([]));
  }, []);

  const chosen = Array.isArray(form.bundle_items) ? form.bundle_items.map(String) : [];
  const byId = useMemo(() => new Map((products || []).map((p) => [String(p.id), p])), [products]);
  const options = (products || [])
    .filter((p) => DIGITAL.includes(p.product_type) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(onSale(b)) - Number(onSale(a)) || String(a.name).localeCompare(String(b.name), "pl"));

  const chosenRows = chosen.map((id) => byId.get(id)).filter(Boolean);
  const separately = Math.round(chosenRows.reduce((s, p) => s + (p.is_free ? 0 : unitPrice(p)), 0) * 100) / 100;
  const pkg = pkgPrice(form);
  const save = Math.round((separately - pkg) * 100) / 100;
  const savePct = separately > 0 ? Math.round((save / separately) * 100) : 0;
  const offChosen = chosenRows.filter((p) => !onSale(p));

  const toggle = (id) => set("bundle_items", chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);

  // Cena z rabatu: pełne złote w dół (np. 118 zł − 20% = 94 zł).
  const applyPct = () => {
    const n = Number(String(pct).replace(",", "."));
    if (!(separately > 0) || !(n > 0 && n < 100)) return;
    const price = Math.max(1, Math.floor(separately * (1 - n / 100)));
    set("price_regular", String(price));
    set("price_start", "");
    set("promo_end_date", "");
  };

  const makeCover = async () => {
    setCover({ busy: true, msg: "" });
    try {
      const file = await makeBundleCover(chosenRows, form.name);
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      set("image_url", file_url);
      set("cover_image", file_url);
      setCover({ busy: false, msg: "Okładka gotowa — zapisz pakiet." });
    } catch (e) {
      setCover({ busy: false, msg: e?.message || "Nie udało się utworzyć okładki." });
    }
  };

  return (
    <div className="mb-10">
      <p className="technical text-[10px] gold-text mb-4">SKŁADNIKI PAKIETU</p>
      <p className="text-xs text-foreground/50 mb-4">
        Wybierz od 2 do 10 produktów cyfrowych, które są w sprzedaży. Kupujący dostaje dostęp do każdego z nich, a czas
        dostępu ustawiony wyżej obejmuje wszystkie. Cena pakietu musi być niższa niż suma cen osobno.
      </p>
      {products === null ? (
        <p className="flex items-center gap-2 text-sm text-foreground/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Ładuję produkty…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {chosen.length === 0 && <span className="text-xs text-foreground/40">Nie wybrano jeszcze żadnego produktu.</span>}
            {chosen.map((id) => {
              const p = byId.get(id);
              const off = p && !onSale(p);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  title="Usuń z pakietu"
                  className={`technical text-[9px] px-3 py-1.5 border inline-flex items-center gap-2 ${
                    off ? "border-red-400/60 text-red-300 bg-red-500/10" : "border-[#C9A24A] gold-text bg-[#C9A24A]/10"
                  }`}
                >
                  {p?.name || "Produkt usunięty"}
                  {off ? ` · ${offLabel(p)}` : ""} <X className="h-3 w-3" />
                </button>
              );
            })}
          </div>
          {offChosen.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-red-300 border border-red-400/40 bg-red-500/10 px-3 py-2 mb-4">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-px" />
              <span>
                {offChosen.map((p) => `„${p.name}”`).join(", ")} nie {offChosen.length > 1 ? "są" : "jest"} w sprzedaży.
                Usuń z pakietu albo zapisz pakiet jako ukryty, dopóki produkt nie wróci do sprzedaży.
              </span>
            </p>
          )}
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
                const sale = onSale(p);
                const disabled = !sale && !on;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(String(p.id))}
                    title={disabled ? "Do pakietu wchodzą tylko produkty w sprzedaży" : undefined}
                    className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                      on ? "bg-[#C9A24A]/10" : disabled ? "opacity-45 cursor-not-allowed" : "hover:bg-[#0F0F10]"
                    }`}
                  >
                    <span className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center ${on ? "border-[#C9A24A] bg-[#C9A24A] text-[#0A0A0B]" : "hairline"}`}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{p.name}</span>
                      <span className="block technical text-[9px] text-foreground/40 mt-0.5">
                        {(TYPE_LABEL[p.product_type] || p.product_type || "").toUpperCase()}
                        {!sale ? ` · ${offLabel(p)}` : ""}
                        {p.is_free ? " · BEZPŁATNY" : ""}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-foreground/60 whitespace-nowrap">{p.is_free ? "0 zł" : zl(unitPrice(p))}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* ===== CENA PAKIETU ===== */}
          <div className="border hairline bg-[#0D0D0E] p-5 mt-6">
            <p className="technical text-[10px] gold-text mb-4">CENA PAKIETU</p>
            <div className="grid sm:grid-cols-3 gap-4 text-sm mb-5">
              <div>
                <span className={lbl}>OSOBNO</span>
                <span className="font-mono text-lg">{zl(separately)}</span>
              </div>
              <div>
                <span className={lbl}>PAKIET</span>
                <span className="font-mono text-lg gold-text">{pkg > 0 ? zl(pkg) : "—"}</span>
              </div>
              <div>
                <span className={lbl}>KLIENT OSZCZĘDZA</span>
                <span className={`font-mono text-lg ${save > 0 ? "text-emerald-400" : "text-red-300"}`}>
                  {pkg > 0 && chosenRows.length ? (save > 0 ? `${zl(save)} (${savePct}%)` : "brak oszczędności") : "—"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className={lbl}>RABAT OD SUMY (%)</span>
                <input type="number" min="1" max="90" value={pct} onChange={(e) => setPct(e.target.value)} className={`${inp} w-28 font-mono`} />
              </label>
              <button type="button" onClick={applyPct} disabled={!(separately > 0)} className="btn-ghost !px-4 !py-2 text-[10px] disabled:opacity-40">
                Ustaw cenę z rabatu
              </button>
              <p className="text-[11px] text-foreground/50 basis-full">
                Cenę można też wpisać ręcznie w polu „Cena regularna” w sekcji Ceny. Rabat zaokrąglam do pełnych złotych w dół.
              </p>
            </div>
            {pkg > 0 && chosenRows.length > 0 && save <= 0 && (
              <p className="text-xs text-red-300 mt-3">Cena pakietu musi być niższa niż {zl(separately)} — inaczej pakietu nie da się zapisać jako widocznego.</p>
            )}
            <label className="flex items-start gap-3 cursor-pointer mt-5">
              <input type="checkbox" checked={!!form.bez_kodow} onChange={(e) => set("bez_kodow", e.target.checked)} className="accent-[#C9A24A] w-4 h-4 mt-0.5" />
              <span>
                <span className="technical text-[10px] text-foreground/70 block">BEZ KODÓW RABATOWYCH</span>
                <span className="text-[11px] text-foreground/50">Pakiet ma już obniżoną cenę, więc kody rabatowe go nie obejmują. Karta podarunkowa działa zawsze.</span>
              </span>
            </label>
          </div>

          {/* ===== OKŁADKA Z OKŁADEK ===== */}
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button type="button" onClick={makeCover} disabled={cover.busy || chosenRows.length < 2} className="btn-ghost !px-4 !py-2 text-[10px] disabled:opacity-40">
              {cover.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Utwórz okładkę z okładek produktów
            </button>
            <span className="text-[11px] text-foreground/50">
              {cover.msg || "Jeśli pakiet nie ma własnej okładki, utworzę ją automatycznie przy zapisie."}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
