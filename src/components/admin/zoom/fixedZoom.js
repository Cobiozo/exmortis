import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Mój stały link Zoom (Ustawienia strony). Jedna kopia na kartę przeglądarki, odświeżana po zapisie.
let cache = null;
let pending = null;
const subs = new Set();

export function loadFixedZoom(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending || force) {
    pending = base44.functions.invoke("adminSettings", { action: "zoom_get" })
      .then((r) => { cache = { link: r.data?.link || "", haslo: r.data?.haslo || "" }; subs.forEach((f) => f(cache)); return cache; })
      .catch(() => { cache = cache || { link: "", haslo: "" }; return cache; })
      .finally(() => { pending = null; });
  }
  return pending;
}

export async function saveFixedZoom(link, haslo) {
  const r = await base44.functions.invoke("adminSettings", { action: "zoom_save", link, haslo });
  cache = { link: r.data?.link || "", haslo: r.data?.haslo || "" };
  subs.forEach((f) => f(cache));
  return cache;
}

export function useFixedZoom() {
  const [z, setZ] = useState(cache);
  useEffect(() => {
    subs.add(setZ);
    loadFixedZoom().then(setZ);
    return () => { subs.delete(setZ); };
  }, []);
  return z; // null = wczytuję
}
