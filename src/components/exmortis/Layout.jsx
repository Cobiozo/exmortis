import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "@/components/exmortis/Navbar";
import Footer from "@/components/exmortis/Footer";
import CartDrawer from "@/components/exmortis/CartDrawer";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0B]">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}