import React from "react";
import { Paperclip } from "lucide-react";
import { KIND, plainText, plDateTime } from "@/components/account/library/libApi";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import MessageFooter from "./MessageFooter";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

// Jedna wiadomość: treść, dołączony materiał jako kafelek i stała stopka.
export default function MessageCard({ m, footer, onRead, onHide, onOpenMaterial }) {
  const attach = m.material_title ? { title: m.material_title, kind: m.material_kind } : m.collection_title ? { title: m.collection_title, kind: null } : null;

  return (
    <article className={`bg-[#0A0A0B] border p-5 ${m.read_at ? "hairline" : "border-[rgba(201,162,74,.5)]"}`}>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#C9A24A]">
          {m.read_at ? "Wiadomość" : "Nowa"}
        </p>
        {m.sent_at && <p className="font-mono text-[11px] text-foreground/40">{plDateTime(m.sent_at)}</p>}
      </div>

      {m.title && <h3 className="shop-heading text-[21px] leading-snug text-[#F5EFE1] mt-2 break-words">{m.title}</h3>}

      <div className="rich-content font-body text-[15px] leading-relaxed text-[#F5EFE1]/85 mt-3"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.text || "") }} />

      {attach && (
        <button type="button" onClick={() => onOpenMaterial(m.material_id, attach)}
          className={`mt-4 w-full flex items-center gap-4 text-left p-4 border hairline hover:border-[rgba(201,162,74,.5)] transition-colors ${FOCUS}`}>
          <Paperclip className="w-5 h-5 shrink-0 text-[#C9A24A]" strokeWidth={1.5} />
          <span className="min-w-0">
            <span className="block font-mono text-[10px] tracking-[0.16em] uppercase text-foreground/45">
              {attach.kind ? KIND[attach.kind] || attach.kind : "Kolekcja"}
            </span>
            <span className="block font-body text-[15px] text-[#F5EFE1] break-words">{attach.title}</span>
          </span>
        </button>
      )}

      <MessageFooter footer={footer} title={m.title} />

      <div className="flex flex-wrap gap-3 mt-4">
        {!m.read_at && (
          <button type="button" onClick={() => onRead(m.id)}
            className={`inline-flex items-center justify-center min-h-[44px] font-mono text-[11px] tracking-[0.14em] uppercase text-[#C9A24A] underline underline-offset-4 hover:text-[#E2C170] ${FOCUS}`}>
            OZNACZ JAKO PRZECZYTANĄ
          </button>
        )}
        <button type="button" onClick={() => onHide(m.id)}
          className={`inline-flex items-center justify-center min-h-[44px] font-mono text-[11px] tracking-[0.14em] uppercase text-foreground/45 underline underline-offset-4 hover:text-[#F5EFE1] ${FOCUS}`}>
          UKRYJ
        </button>
      </div>
    </article>
  );
}

export const preview = (html) => plainText(html).slice(0, 200);