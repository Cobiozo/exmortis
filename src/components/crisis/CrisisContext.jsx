import React, { createContext, useCallback, useContext, useEffect, useState, Suspense } from "react";

// Jedno okno kryzysowe dla całej aplikacji — otwierane przyciskiem albo po pilnym zgłoszeniu.
// Plik okna doładowuje się w tle po starcie strony (bez obciążania pierwszego wyświetlenia).
// Gdy pliku nie da się pobrać (brak sieci, świeża publikacja), pokazujemy prosty awaryjny widok
// z tymi samymi numerami — okno pomocy nie może nigdy skończyć się ekranem błędu.
const NUMBERS = [
  { tel: "116123", label: "116 123", desc: "telefon zaufania dla dorosłych w kryzysie emocjonalnym, całą dobę" },
  { tel: "800702222", label: "800 70 2222", desc: "Centrum Wsparcia, całą dobę" },
  { tel: "112", label: "112", desc: "zagrożenie życia" },
];

function CrisisFallback({ open, onOpenChange }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onOpenChange]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="crisis-fb-title" className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto border border-[#3D3D3F] bg-[#0A0A0B] p-7" onClick={(e) => e.stopPropagation()}>
        <h2 id="crisis-fb-title" className="relic-heading text-2xl leading-tight text-foreground mb-4">Jeśli jest Ci teraz bardzo ciężko</h2>
        <p className="text-foreground/70 leading-relaxed mb-4">
          Jeśli jest Ci bardzo ciężko albo myślisz o odebraniu sobie życia — nie musisz zostać z tym
          w samotności. Zadzwoń. Te numery są bezpłatne i działają całą dobę.
        </p>
        <div className="space-y-3 mb-4">
          {NUMBERS.map((n) => (
            <a key={n.tel} href={`tel:${n.tel}`} className="block border border-[#3D3D3F] px-5 py-4">
              <span className="relic-heading block text-3xl gold-text">{n.label}</span>
              <span className="mt-1 block text-xs text-foreground/60">{n.desc}</span>
            </a>
          ))}
        </div>
        <button type="button" onClick={() => onOpenChange(false)} className="btn-ghost w-full">ZAMKNIJ</button>
      </div>
    </div>
  );
}

const loadDialog = () => import("./CrisisDialog");
// Dwie próby pobrania, potem widok awaryjny (zawsze działa, nawet offline).
const CrisisDialog = React.lazy(() => loadDialog().catch(() => loadDialog()).catch(() => ({ default: CrisisFallback })));

const Ctx = createContext({ open: () => {}, isOpen: false });

export const useCrisis = () => useContext(Ctx);

export function CrisisProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const openCrisis = useCallback(() => { setMounted(true); setOpen(true); }, []);
  // Dociągnięcie okna w wolnej chwili po starcie — kliknięcie „Nagła pomoc” otwiera je od razu.
  useEffect(() => {
    const go = () => { loadDialog().catch(() => {}); };
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(go, { timeout: 6000 }) : setTimeout(go, 4000);
    return () => { if ("cancelIdleCallback" in window) window.cancelIdleCallback(id); else clearTimeout(id); };
  }, []);
  return (
    <Ctx.Provider value={{ open: openCrisis, isOpen: open }}>
      {children}
      {mounted && (
        <Suspense fallback={<CrisisFallback open={open} onOpenChange={setOpen} />}>
          <CrisisDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
