import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "@/components/exmortis/Navbar";
import Footer from "@/components/exmortis/Footer";
import CartDrawer from "@/components/exmortis/CartDrawer";
import usePrelaunch from "@/lib/usePrelaunch";

export default function Layout() {
  const { gated, loading } = usePrelaunch();
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0B]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {!gated && !loading && <CartDrawer />}
    </div>
  );
}