import React, { createContext, useCallback, useContext, useState, Suspense } from "react";

// Jedno okno kryzysowe dla całej aplikacji — otwierane przyciskiem albo po pilnym zgłoszeniu.
// Plik okna doładowuje się dopiero przy pierwszym otwarciu, żeby nie obciążał startu strony.
const CrisisDialog = React.lazy(() => import("./CrisisDialog"));
const Ctx = createContext({ open: () => {}, isOpen: false });

export const useCrisis = () => useContext(Ctx);

export function CrisisProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const openCrisis = useCallback(() => { setMounted(true); setOpen(true); }, []);
  return (
    <Ctx.Provider value={{ open: openCrisis, isOpen: open }}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <CrisisDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}