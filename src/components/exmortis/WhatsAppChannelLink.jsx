import React from "react";
import { MessageCircle } from "lucide-react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { waChannel, WHATSAPP_CHANNEL } from "@/lib/whatsappChannel";
import { track } from "@/lib/track";

// Wspólny odnośnik do kanału WhatsApp. Adres z jednego źródła (lib/whatsappChannel.js),
// z możliwością nadpisania w Treściach (contact.whatsapp). Brak adresu → nic się nie renderuje.
// Zawsze w nowej karcie z rel="noopener noreferrer"; kliknięcie mierzone jako whatsapp_click { miejsce }.
export default function WhatsAppChannelLink({
  miejsce,
  label = "DOŁĄCZ DO KANAŁU WHATSAPP",
  caption,
  framed = false,
  className = "",
}) {
  const { str } = useSiteContent();
  const href = waChannel(str("contact", "whatsapp", WHATSAPP_CHANNEL));
  if (!href) return null;

  const open = () => track("whatsapp_click", { miejsce });
  const aria = `${label} — kanał WhatsApp exmortis (otwiera się w nowej karcie)`;

  if (!framed) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={open}
        aria-label={aria}
        className={`btn-relic max-w-full text-center ${className}`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </a>
    );
  }

  return (
    <div className={className}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={open}
        aria-label={aria}
        className="group inline-flex min-h-[44px] max-w-full items-center gap-3 border hairline py-1 pl-1 pr-5 transition-colors hover:border-[#C9A24A]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center border-r hairline">
          <MessageCircle className="h-4 w-4 text-foreground/70 transition-colors group-hover:text-[#C9A24A]" aria-hidden="true" />
        </span>
        <span className="technical text-[10px] text-foreground/85 transition-colors group-hover:text-[#C9A24A]">{label}</span>
      </a>
      {caption && <p className="technical mt-2 text-[9px] text-foreground/45">{caption}</p>}
    </div>
  );
}