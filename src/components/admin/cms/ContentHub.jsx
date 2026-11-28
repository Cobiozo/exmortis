import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ContentManager from "@/components/admin/ContentManager";
import PagesList from "./PagesList";
import MediaLibrary from "./media/MediaLibrary";
import PageEditor from "./PageEditor";
import ThoughtsEditor from "./thoughts/ThoughtsEditor";
import { ViewTabs } from "@/components/admin/ui/kit";

// „Treści stron”: edytor stron z bloków + dotychczasowe teksty sekcji (moduły).
export default function ContentHub() {
  const params = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(params.get("tab") === "teksty" ? "teksty" : "strony");
  const [pageId, setPageId] = useState(params.get("strona"));
  useEffect(() => {
    const slug = params.get("slug");
    if (slug) base44.entities.SitePage.filter({ slug }, { limit: 1 }).then((p) => p.items[0] && open(p.items[0].id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id) => {
    setPageId(id);
    const u = new URL(window.location.href);
    id ? u.searchParams.set("strona", id) : u.searchParams.delete("strona");
    u.searchParams.delete("slug");
    window.history.replaceState(null, "", u);
  };
  return (
    <div>
      {!pageId && (
        <div className="mb-8"><ViewTabs tabs={[["strony", "Strony"], ["media", "Media"], ["teksty", "Teksty systemowe i sekcji"], ["mysli", "Myśli dnia"]]} value={tab} onChange={setTab} label="Treści" /></div>
      )}
      {tab === "mysli" && !pageId ? <ThoughtsEditor /> : tab === "media" && !pageId ? <MediaLibrary /> : tab === "teksty" && !pageId ? <ContentManager /> : pageId ? <PageEditor pageId={pageId} onBack={() => open(null)} /> : <PagesList onOpen={open} />}
    </div>
  );
}