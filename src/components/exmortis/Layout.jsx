import React from "react";
import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import Navbar from "@/components/exmortis/Navbar";
import Footer from "@/components/exmortis/Footer";
import CartDrawer from "@/components/exmortis/CartDrawer";
import SiteLoader from "@/components/prelaunch/SiteLoader";
import usePrelaunch from "@/lib/usePrelaunch";
import ErrorBoundary from "@/components/errors/ErrorBoundary";

export default function Layout() {
  const { gated, loading } = usePrelaunch();
  if (loading) return <SiteLoader />;
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0B]">
      <Navbar />
      <main className="flex-1">
        <ErrorBoundary>
          {/* Menu i stopka zostają na miejscu, gdy kolejna strona dociąga się z serwera. */}
          <Suspense fallback={<div className="min-h-[100svh] flex items-center justify-center"><div className="w-7 h-7 border-2 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      {!gated && <CartDrawer />}
    </div>
  );
}