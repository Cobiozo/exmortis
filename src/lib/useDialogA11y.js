import { useEffect, useRef } from "react";

// Okna i panele (koszyk, menu, „Powiadom mnie”, okno pomocy): po otwarciu fokus wchodzi do środka,
// Tab krąży wewnątrz, Escape zamyka, a po zamknięciu fokus wraca do elementu, który okno otworzył.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useDialogA11y(open, ref, onClose, { trap = true } = {}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const items = () =>
      [...(ref.current?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.getClientRects().length > 0);
    const t = setTimeout(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) items()[0]?.focus();
    }, 30);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (!trap || e.key !== "Tab" || !ref.current) return;
      const list = items();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const inside = ref.current.contains(document.activeElement);
      if (!inside) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [open, ref, trap]);
}
