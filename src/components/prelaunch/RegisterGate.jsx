import React from "react";
import { Link } from "react-router-dom";
import Register from "@/pages/Register";
import AuthLayout from "@/components/AuthLayout";
import SiteLoader from "./SiteLoader";
import usePrelaunch from "@/lib/usePrelaunch";

// W trybie przedpremierowym goście (spoza listy dostępu) zamiast rejestracji widzą informację o starcie kont.
export default function RegisterGate() {
  const { gated, loading } = usePrelaunch();
  if (loading) return <SiteLoader />;
  if (!gated) return <Register />;
  return (
    <AuthLayout title="Załóż konto" subtitle="exmortis">
      <p className="text-foreground/85 text-lg leading-relaxed mb-6">Konta ruszają 1 listopada.</p>
      <Link to="/1-listopada" className="btn-relic">Zapisz się na spotkanie →</Link>
    </AuthLayout>
  );
}