import React from "react";
import { Paperclip } from "lucide-react";
import { KIND, plainText, plDateTime } from "@/components/account/library/libApi";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import MessageFooter from "./MessageFooter";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

// Jedna wiadomość: treść, dołączony materiał jako kafelek i stała stopka.
export default function MessageCard({ m, footer, onRead, onHide, onOpenMaterial }) {
  // Wszystkie załączniki (nowe wiadomości) albo pojedynczy materiał / kolekcja (starsze).
  const list = Array.isArray(m.attachments) && m.attachments.length
    ? m.attachments
        .filter((a) => a.material_title || a.collection_title)
        .map((a) => ({ id: a.material_id, title: a.material_title || a.collection_title, kind: a.material_id ? a.material_kind : null }))
    : m.material_title
      ? [{ id: m.material_id, title: m.material_title, kind: m.material_kind }]
      : m.collection_title ? [{ id: null, title: m.collection_title, kind: null }] : [];

  return (
    <article className={`bg-[#0A0A0B] border p-5 ${m.read_at ? "hairline" : "border-[rgba(201,162,74,.5)]"}`}>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#C9A24A]">
          {m.read_at ? "Wiadomość" : "Nowa"}
        </p>
        {m.sent_at && <p className="font-mono text-[11px] text-foreground/55">{plDateTime(m.sent_at)}</p>}
      </div>

      {m.title && <h3 className="shop-heading text-[21px] leading-snug text-[#F5EFE1] mt-2 break-words">{m.title}</h3>}

      <div className="rich-content font-body text-[15px] leading-relaxed text-[#F5EFE1]/85 mt-3"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.text || "") }} />

      {list.length > 0 && (
        <div className="mt-4 space-y-2">
          {list.map((x, i) => (
            x.id ? (
              <button key={i} type="button" onClick={() => onOpenMaterial(x.id, x)}
                className={`w-full flex items-center gap-4 text-left p-4 border hairline hover:border-[rgba(201,162,74,.5)] transition-colors ${FOCUS}`}>
                <Paperclip className="w-5 h-5 shrink-0 text-[#C9A24A]" strokeWidth={1.5} />
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] tracking-[0.16em] uppercase text-foreground/55">{KIND[x.kind] || x.kind || "Materiał"}</span>
                  <span className="block font-body text-[15px] text-[#F5EFE1] break-words">{x.title}</span>
                </span>
              </button>
            ) : (
              <div key={i} className="w-full flex items-center gap-4 p-4 border hairline">
                <Paperclip className="w-5 h-5 shrink-0 text-[#C9A24A]" strokeWidth={1.5} />
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] tracking-[0.16em] uppercase text-foreground/55">Kolekcja · w zakładce „Moja biblioteka”</span>
                  <span className="block font-body text-[15px] text-[#F5EFE1] break-words">{x.title}</span>
                </span>
              </div>
            )
          ))}
        </div>
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
          className={`inline-flex items-center justify-center min-h-[44px] font-mono text-[11px] tracking-[0.14em] uppercase text-foreground/55 underline underline-offset-4 hover:text-[#F5EFE1] ${FOCUS}`}>
          UKRYJ
        </button>
      </div>
    </article>
  );
}

export const preview = (html) => plainText(html).slice(0, 200);