import React from "react";
import { useAuth } from "@/lib/AuthContext";
import ObokTeaser from "@/components/obok/ObokTeaser";
import SeriesTiles from "@/components/obok/SeriesTiles";
import { OBOK_SUB } from "@/components/obok/obokApi";

// /obok — zapowiedź dla gości, serie dla zalogowanych.
export default function Obok() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <ObokTeaser />;
  return (
    <section className="px-5 md:px-10 pt-32 pb-24">
      <div className="mx-auto max-w-[1200px]">
        <p className="technical text-[10px] gold-text mb-6">OBOK</p>
        <h1 className="relic-heading text-4xl md:text-5xl text-[#F5EFE1] mb-6">Kilka minut mojego głosu.</h1>
        <p className="text-foreground/65 max-w-[60ch] mb-14">{OBOK_SUB}</p>
        <SeriesTiles />
      </div>
    </section>
  );
}