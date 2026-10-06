import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductTile from "./ProductTile";

export default function MyProducts() {
  const [list, setList] = useState(null);
  useEffect(() => {
    base44.functions.invoke("myAccount", { action: "products" }).then((r) => setList(r.data.products));
  }, []);

  if (!list) return <p className="text-foreground/50">Ładowanie…</p>;
  if (!list.length) {
    return (
      <div className="py-16 text-center">
        <p className="shop-heading text-2xl text-[#F5EFE1]">Na razie nic tu nie ma. Zajrzyj do Skarbca.</p>
        <Link to="/sklep" className="btn-ghost mt-8">SKARBIEC</Link>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {list.map((p) => <ProductTile key={p.access_id} p={p} />)}
    </div>
  );
}