import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import usePrelaunch, { isHiddenPath } from "@/lib/usePrelaunch";
import { useAdminMode } from "@/components/admin/AdminModeContext";

// Tryb przedpremierowy: gość trafiający na ukryty adres wraca na zapowiedź (przekierowanie tymczasowe).
// Wyjątek: administrator zawsze widzi ROZDROŻA w koncie (podgląd szkicu i „jak klient”), także w widoku „gość”.
export default function PrelaunchGate({ children }) {
  const { gated, loading, provisional } = usePrelaunch();
  const { isAdmin, ready } = useAdminMode();
  const { pathname } = useLocation();
  const adminRz = pathname.startsWith("/konto/rozdroza");
  if (adminRz && !ready && isHiddenPath(pathname)) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  if (adminRz && isAdmin) return children;
  if ((loading || provisional) && isHiddenPath(pathname)) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  if (gated && isHiddenPath(pathname)) return <Navigate to="/" replace />;
  return children;
}
