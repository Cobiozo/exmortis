import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { pagePath } from "@/components/cms/links";
import Editor from "./Editor";

// Ładuje stronę i listę opublikowanych stron (do wyboru w linkach), potem otwiera edytor.
export default function PageEditor({ pageId, onBack }) {
  const [page, setPage] = useState(null);
  const [extra, setExtra] = useState([]);
  useEffect(() => {
    base44.entities.SitePage.get(pageId).then(setPage);
    base44.entities.PublishedPage.filter({}, { limit: 200, fields: ["slug", "tytul"] })
      .then((p) => setExtra(p.items.filter((x) => x.slug !== "home").map((x) => [pagePath(x.slug), x.tytul || x.slug])));
  }, [pageId]);
  if (!page) return <div className="h-64 border hairline animate-pulse bg-[#0F0F10]" />;
  return <Editor page={page} setPage={setPage} extra={extra} onBack={onBack} />;
}