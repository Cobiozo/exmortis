import React from "react";
import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Navbar from "@/components/exmortis/Navbar";
import Footer from "@/components/exmortis/Footer";
import CartDrawer from "@/components/exmortis/CartDrawer";
import SiteLoader from "@/components/prelaunch/SiteLoader";
import usePrelaunch from "@/lib/usePrelaunch";
import ErrorBoundary from "@/components/errors/ErrorBoundary";
import SitePopup from "@/components/exmortis/SitePopup";

export default function Layout() {
  const { gated, loading } = usePrelaunch();
  if (loading) return <SiteLoader />;
  return (
    <div className="exm-soft-page min-h-screen flex flex-col bg-[#0A0A0B]">
      {/* Link pomijania nawigacji — widoczny dopiero po Tab (WCAG 2.4.1, audyt 17.11.2026, X-27). */}
      <a href="#tresc" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[300] focus:bg-[#0A0A0B] focus:border focus:border-[#C9A24A] focus:px-4 focus:py-2 focus:text-[#C9A24A] text-sm">Przejdź do treści</a>
      <Navbar />
      <main id="tresc" tabIndex={-1} className="flex-1 focus:outline-none">
        <ErrorBoundary>
          {/* Menu i stopka zostają na miejscu, gdy kolejna strona dociąga się z serwera. */}
          <Suspense fallback={<div className="min-h-[100svh] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      {!gated && <CartDrawer />}
      {!gated && <SitePopup />}
    </div>
  );
}