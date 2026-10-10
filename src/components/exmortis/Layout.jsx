import React from "react";
import { Outlet } from "react-router-dom";
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
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </main>
      <Footer />
      {!gated && <CartDrawer />}
    </div>
  );
}