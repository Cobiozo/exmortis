import React, { createContext, useCallback, useContext, useState } from "react";
import CrisisDialog from "./CrisisDialog";

// Jedno okno kryzysowe dla całej aplikacji — otwierane przyciskiem albo po pilnym zgłoszeniu.
const Ctx = createContext({ open: () => {} });

export const useCrisis = () => useContext(Ctx);

export function CrisisProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openCrisis = useCallback(() => setOpen(true), []);
  return (
    <Ctx.Provider value={{ open: openCrisis, isOpen: open }}>
      {children}
      <CrisisDialog open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}