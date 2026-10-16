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
  if (!list) return <p className="text-foreground/55">Ładowanie…</p>;
  if (!list.length) {
    return (
      <div className="py-16 text-center">
        <p className="shop-heading text-2xl text-[#F5EFE1]">Na razie nic tu nie ma. Zajrzyj do Skarbca.</p>
        <Link to="/skarbiec" className="btn-ghost mt-8">SKARBIEC</Link>
      </div>
    );
  }
  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((p) => <ProductTile key={p.access_id} p={p} />)}
      </div>
      <NextStepCard step={next} />
    </>
  );
}