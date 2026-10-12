import React from "react";
import Home from "@/pages/Home";
import Listopad from "@/pages/Listopad";
import usePrelaunch from "@/lib/usePrelaunch";

// Strona główna: w trybie przedpremierowym gość widzi od razu stronę spotkania 1 listopada (/1-listopada).
export default function HomeSwitch() {
  const { gated, loading } = usePrelaunch();
  if (loading) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return gated ? <Listopad /> : <Home />;
}