import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductTile from "./ProductTile";
import NextStepCard from "./NextStepCard";

export default function MyProducts() {
  const [list, setList] = useState(null);
  const [next, setNext] = useState(null);
  const [err, setErr] = useState(false);
  const load = () => {
    setErr(false); setList(null);
    base44.functions.invoke("myAccount", { action: "products" })
      .then((r) => { setList(r.data.products); setNext(r.data.next || null); })
      .catch(() => setErr(true));
  };
  useEffect(load, []);

  if (err) return (
    <div className="py-16 text-center">
      <p className="text-foreground/60 mb-4">Nie udało się wczytać produktów.</p>
      <button onClick={load} className="btn-ghost !py-2 !px-4">Ponów</button>
    </div>
  );
  if (!list) return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Wczytuję produkty">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border hairline bg-[#111113] overflow-hidden">
          <div className="aspect-[4/3] bg-white/[0.05] animate-pulse motion-reduce:animate-none" />
          <div className="p-5 space-y-2"><div className="h-4 w-3/4 rounded bg-white/[0.06]" /><div className="h-3 w-1/2 rounded bg-white/[0.06]" /></div>
        </div>
      ))}
    </div>
  );
  if (!list.length) {
    return (
      <div className="rounded-2xl border hairline bg-[#111113] p-6 md:p-8">
        <p className="shop-heading text-2xl text-[#F5EFE1]">Nie masz jeszcze żadnych produktów.</p>
        <p className="text-base text-[#F5EFE1]/75 mt-2 max-w-[52ch]">W Skarbcu znajdziesz materiały na każdy etap drogi — także bezpłatne. To, co wybierzesz, pojawi się tutaj.</p>
        <Link to="/skarbiec" className="btn-ghost mt-6">ZAJRZYJ DO SKARBCA</Link>
      </div>
    );
  }
  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((p) => <ProductTile key={p.access_id} p={p} />)}
      </div>
      <NextStepCard step={next} className="mt-8" />
    </>
  );
}