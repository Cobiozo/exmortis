import React from "react";
import Home from "@/pages/Home";
import CmsRoutePage from "@/components/cms/CmsRoutePage";
import usePrelaunch from "@/lib/usePrelaunch";

// Strona główna: w trybie przedpremierowym gość widzi „Stronę główną — zapowiedź”.
export default function HomeSwitch() {
  const { gated, loading } = usePrelaunch();
  if (loading) return <div className="min-h-[100svh] bg-[#0A0A0B]" />;
  return gated ? <CmsRoutePage slug="zapowiedz" /> : <Home />;
}