import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import usePrelaunch, { isHiddenPath } from "@/lib/usePrelaunch";

// Tryb przedpremierowy: gość trafiający na ukryty adres wraca na zapowiedź (przekierowanie tymczasowe).
export default function PrelaunchGate({ children }) {
  const { gated, loading } = usePrelaunch();
  const { pathname } = useLocation();
  if (loading && isHiddenPath(pathname)) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  if (gated && isHiddenPath(pathname)) return <Navigate to="/" replace />;
  return children;
}