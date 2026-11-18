import React, { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import EmptyState from "@/components/exmortis/ui/EmptyState";
import BrandButton from "@/components/exmortis/ui/BrandButton";
import SkeletonBlock from "@/components/exmortis/ui/SkeletonBlock";
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
        <div key={i} className="overflow-hidden rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface">
          <SkeletonBlock className="aspect-[4/3] w-full" rounded="0" />
          <div className="space-y-2 p-5"><SkeletonBlock className="h-4 w-3/4" /><SkeletonBlock className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
  if (!list.length) {
    return (
      <EmptyState
        icon={<Package />}
        title="Nie masz jeszcze żadnych produktów."
        description="W Skarbcu znajdziesz materiały na każdy etap drogi — także bezpłatne. To, co wybierzesz, pojawi się tutaj."
        action={<BrandButton to="/skarbiec" variant="secondary">Zajrzyj do Skarbca</BrandButton>}
      />
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