import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ContentManager from "@/components/admin/ContentManager";
import PagesList from "./PagesList";
import MediaLibrary from "./media/MediaLibrary";
import PageEditor from "./PageEditor";
import { tabBtn } from "./ui";
import ThoughtsEditor from "./thoughts/ThoughtsEditor";

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
        <div className="flex gap-2 mb-8">
          <button className={tabBtn(tab === "strony")} onClick={() => setTab("strony")}>STRONY</button>
          <button className={tabBtn(tab === "media")} onClick={() => setTab("media")}>MEDIA</button>
          <button className={tabBtn(tab === "teksty")} onClick={() => setTab("teksty")}>TEKSTY SYSTEMOWE I SEKCJI</button>
          <button className={tabBtn(tab === "mysli")} onClick={() => setTab("mysli")}>MYŚLI DNIA</button>
        </div>
      )}
      {tab === "mysli" && !pageId ? <ThoughtsEditor /> : tab === "media" && !pageId ? <MediaLibrary /> : tab === "teksty" && !pageId ? <ContentManager /> : pageId ? <PageEditor pageId={pageId} onBack={() => open(null)} /> : <PagesList onOpen={open} />}
    </div>
  );
}