import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { takePage } from "@/lib/prefetch";
import { readCache, writeCache } from "@/lib/swrCache";

// Opublikowana wersja strony: undefined = ładowanie, null = brak. Kopia z poprzedniej wizyty od razu, świeża w tle.
export default function usePublishedPage(slug) {
  const [page, setPage] = useState(() => readCache("page_" + slug));
  useEffect(() => {
    setPage(readCache("page_" + slug));
    (takePage(slug) || base44.entities.PublishedPage.filter({ slug }, { limit: 1 }))
      .then((p) => { const v = p.items[0] || null; writeCache("page_" + slug, v); setPage(v); })
      .catch(() => setPage((x) => (x === undefined ? null : x)));
  }, [slug]);
  useEffect(() => {
    if (page?.seo_title) document.title = page.seo_title;
  }, [page]);
  return page;
}