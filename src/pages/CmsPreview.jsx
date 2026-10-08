import React, { useEffect, useRef, useState } from "react";
import BlockRenderer from "@/components/cms/BlockRenderer";
import PreviewTools from "@/components/cms/PreviewTools";
import { blockName } from "@/components/cms/blockTypes";
import { startInlineEdit } from "@/components/cms/inlineEdit";

const post = (msg) => window.parent.postMessage(msg, window.location.origin);

// Podgląd szkicu w ramce edytora: zaznaczanie, pasek akcji, edycja tekstu dwuklikiem, skróty.
export default function CmsPreview() {
  const [blocks, setBlocks] = useState(null);
  const [sel, setSel] = useState(null);
  const latest = useRef(null);
  latest.current = blocks;
  useEffect(() => {
    const on = (e) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "cms-blocks") { setBlocks(e.data.blocks); setSel(e.data.selectedId); }
      if (e.data?.type === "cms-scroll") document.querySelector(`[data-block="${e.data.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const key = (k) => {
      if (k.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(k.target.tagName)) return;
      post({ type: "cms-key", key: k.key, ctrl: k.ctrlKey || k.metaKey, alt: k.altKey, shift: k.shiftKey });
      if ((k.ctrlKey || k.metaKey) && /^[sdzy]$/i.test(k.key)) k.preventDefault();
    };
    window.addEventListener("message", on);
    window.addEventListener("keydown", key);
    post({ type: "cms-ready" });
    return () => { window.removeEventListener("message", on); window.removeEventListener("keydown", key); };
  }, []);
  if (!blocks) return <div className="min-h-screen bg-[#0A0A0B]" />;
  return (
    <div onDoubleClick={(e) => startInlineEdit(e, latest.current, post)}>
      <BlockRenderer blocks={blocks} editable selectedId={sel} onSelect={(id) => post({ type: "cms-select", id })}
        tools={(b) => <PreviewTools name={blockName(b)} onAction={(a) => post({ type: "cms-action", action: a, id: b.id })} />} />
    </div>
  );
}