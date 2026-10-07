import React, { useEffect, useState } from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";

// Podgląd szkicu w ramce edytora. Bloki przychodzą z okna edytora (postMessage).
export default function CmsPreview() {
  const [blocks, setBlocks] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const on = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "cms-blocks") { setBlocks(e.data.blocks); setSel(e.data.selectedId); }
      if (e.data?.type === "cms-scroll") document.querySelector(`[data-block="${e.data.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("message", on);
    window.parent.postMessage({ type: "cms-ready" }, window.location.origin);
    return () => window.removeEventListener("message", on);
  }, []);
  if (!blocks) return <div className="min-h-screen bg-[#0A0A0B]" />;
  return <BlockRenderer blocks={blocks} editable selectedId={sel}
    onSelect={(id) => window.parent.postMessage({ type: "cms-select", id }, window.location.origin)} />;
}