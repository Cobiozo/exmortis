import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Opublikowana wersja strony: undefined = ładowanie, null = brak.
export default function usePublishedPage(slug) {
  const [page, setPage] = useState(undefined);
  useEffect(() => {
    setPage(undefined);
    base44.entities.PublishedPage.filter({ slug }, { limit: 1 })
      .then((p) => setPage(p.items[0] || null)).catch(() => setPage(null));
  }, [slug]);
  useEffect(() => {
    if (page?.seo_title) document.title = page.seo_title;
  }, [page]);
  return page;
}