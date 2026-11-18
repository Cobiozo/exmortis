import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Katalog produktów (shopProducts) pobierany raz na wejście — wspólny dla sekcji strony głównej
// (pierwszy krok, współpraca). Ceny zawsze z tego samego źródła co Skarbiec i kasa.
let pending = null;

export function loadCatalog() {
  if (!pending) {
    pending = base44.functions.invoke("shopProducts", {})
      .then((r) => r?.data?.products || [])
      .catch(() => { pending = null; return []; });
  }
  return pending;
}

export default function useCatalog() {
  const [products, setProducts] = useState(null);
  useEffect(() => {
    let live = true;
    loadCatalog().then((p) => { if (live) setProducts(p); });
    return () => { live = false; };
  }, []);
  const bySlug = (slug) => (products || []).find((p) => p.slug === slug) || null;
  return { products, bySlug };
}