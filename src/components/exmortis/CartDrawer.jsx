import React, { useRef } from "react";
import useDialogA11y from "@/lib/useDialogA11y";
import { X } from "lucide-react";
import { useCart, lineKey } from "./CartContext";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import CartLine from "./cart/CartLine";
import CartEmpty from "./cart/CartEmpty";
import BundleNotices from "./cart/BundleNotices";
import { zl } from "@/lib/productPrice";

// Liczba pozycji po polsku: 1 pozycja, 2 pozycje, 5 pozycji.
const positions = (n) => {
  if (n === 1) return "1 pozycja";
  const d = n % 10;
  const dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? `${n} pozycje` : `${n} pozycji`;
};

export default function CartDrawer() {
  const { items, open, setOpen, removeItem, updateQty, count, total } = useCart();
  // Esc zamyka koszyk, fokus wchodzi do panelu i wraca do ikony koszyka po zamknięciu.
  const panelRef = useRef(null);
  useDialogA11y(open, panelRef, () => setOpen(false));
  const close = () => setOpen(false);

  return (
    <div className={`fixed inset-0 z-[60] overflow-hidden ${open ? "visible" : "invisible"}`}>
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Koszyk"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-exm-line bg-exm-bg transition-transform duration-300 motion-reduce:transition-none ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-exm-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="exm-h3">Koszyk</h2>
            <p className="mt-1 text-[13px] text-exm-muted">{items.length ? positions(count) : "Brak pozycji"}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Zamknij koszyk"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-[var(--exm-r-field)] text-exm-muted hover:bg-exm-surface-2 hover:text-exm-ivory"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          {items.length === 0 ? (
            <div className="py-10">
              <CartEmpty onNavigate={close} />
            </div>
          ) : (
            <>
            <BundleNotices className="pt-5" />
            <ul className="divide-y divide-exm-line">
              {items.map((item) => (
                <CartLine
                  key={lineKey(item)}
                  item={item}
                  onNavigate={close}
                  onRemove={() => removeItem(lineKey(item))}
                  onQty={(qty) => updateQty(lineKey(item), qty)}
                />
              ))}
            </ul>
            </>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-exm-line px-6 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-exm-muted">Razem</span>
              <span className="font-exm-serif text-2xl text-exm-gold">{zl(total)}</span>
            </div>
            <BrandButton to="/kasa" onClick={close} className="mt-4 w-full">
              Przejdź do kasy
            </BrandButton>
            <button type="button" onClick={close} className="btn-link mt-1 w-full justify-center">
              Kontynuuj zakupy
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}