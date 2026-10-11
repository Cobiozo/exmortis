import React from "react";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A24A]";

// Stała stopka każdej wiadomości. „Odpowiedz e-mailem" prowadzi na skrzynkę kontaktową
// exmortis (nie na adres klienta). WhatsApp pokazuje się tylko, gdy jest ustawiony.
export default function MessageFooter({ footer, title }) {
  const mail = footer && footer.mailto ? footer.mailto : null;
  const href = mail ? `${mail}?subject=${encodeURIComponent(`Re: ${title || "Wiadomość"}`)}` : null;

  return (
    <div className="mt-5 pt-5 border-t hairline space-y-4">
      <p className="font-body text-[14px] leading-relaxed text-foreground/60">
        {footer && footer.reply ? footer.reply : "Na tę wiadomość odpowiesz e-mailem lub na WhatsAppie."}
      </p>
      <div className="flex flex-wrap gap-3">
        {href && (
          <a href={href} className={`inline-flex items-center justify-center min-h-[44px] px-5 border border-[#C9A24A] text-[#C9A24A] font-mono text-xs tracking-[0.14em] uppercase hover:bg-[#C9A24A] hover:text-[#0A0A0B] transition-colors ${FOCUS}`}>
            ODPOWIEDZ E-MAILEM
          </a>
        )}
        {footer && footer.whatsapp && (
          <a href={footer.whatsapp} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center justify-center min-h-[44px] px-5 border hairline text-[#F5EFE1] font-mono text-xs tracking-[0.14em] uppercase hover:border-[#C9A24A] hover:text-[#C9A24A] transition-colors ${FOCUS}`}>
            WHATSAPP
          </a>
        )}
      </div>
      {footer && footer.crisis && (
        <p className="font-body text-[13px] leading-relaxed text-[#F5EFE1]/45">{footer.crisis}</p>
      )}
    </div>
  );
}