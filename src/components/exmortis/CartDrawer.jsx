import React, { useEffect } from "react";
import { X, Plus, Minus, Trash2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart, lineKey } from "./CartContext";
import { GiftLine } from "./shop/GiftCard";
import { TicketLine } from "./events/TicketBuy";

export default function CartDrawer() {
  const { items, open, setOpen, removeItem, updateQty, total } = useCart();
  // Esc zamyka koszyk (klawiatura, czytniki ekranu).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-md bg-[#0A0A0B] border-l hairline flex flex-col transition-transform duration-400 ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-6 border-b hairline">
            <p className="technical text-[11px] gold-text">SKARBIEC · TWÓJ KOSZYK</p>
            <button onClick={() => setOpen(false)} aria-label="Zamknij koszyk" className="text-foreground/60 hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-4">
                <p className="relic-heading text-2xl text-foreground/55">Pusto</p>
                <p className="text-sm text-foreground/50">
                  Skarbiec czeka. Wybierz coś z drogi powrotu.
                </p>
                <Link to="/skarbiec" onClick={() => setOpen(false)} className="btn-ghost mt-2">
                  DO SKLEPU
                </Link>
              </div>
            ) : (
              <ul className="divide-y hairline">
                {items.map((item) => (
                  <li key={lineKey(item)} className="p-6 flex gap-4">
                    <div className="w-20 h-20 bg-card border hairline overflow-hidden flex-shrink-0">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={item.kind === "bilet" ? `/spotkania/${item.slug}` : `/skarbiec/${item.slug}`}
                        onClick={() => setOpen(false)}
                        className="relic-heading text-sm gold-text block truncate"
                      >
                        {item.name}
                      </Link>
                      <p className="font-mono text-sm text-foreground/70 mt-1">{item.price} zł</p>
                      {item.gift && <GiftLine gift={item.gift} />}
                      {item.kind === "bilet" && <TicketLine holders={item.holders} />}
                      <div className="flex items-center gap-3 mt-3">
                        {item.kind === "bilet" ? <span className="font-mono text-xs text-foreground/60">× {item.qty}</span> : (
                        <div className="flex items-center border hairline">
                          <button
                            onClick={() => updateQty(lineKey(item), item.qty - 1)}
                            aria-label="Mniej"
                            className="p-2.5 text-foreground/60 hover:gold-text"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-3 font-mono text-xs" aria-live="polite">{item.qty}</span>
                          <button
                            onClick={() => updateQty(lineKey(item), item.qty + 1)}
                            aria-label="Więcej"
                            className="p-2.5 text-foreground/60 hover:gold-text"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        )}
                        <button
                          onClick={() => removeItem(lineKey(item))}
                          aria-label={`Usuń z koszyka: ${item.name}`}
                          className="p-2.5 -m-1 text-foreground/55 hover:blood-text"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <div className="p-6 border-t hairline space-y-4">
              <div className="flex justify-between items-center">
                <span className="technical text-[11px] text-foreground/60">RAZEM</span>
                <span className="font-mono text-2xl gold-text">{total} zł</span>
              </div>
              <Link
                to="/kasa"
                onClick={() => setOpen(false)}
                className="btn-relic w-full"
              >
                PRZEJDŹ DO KASY <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}