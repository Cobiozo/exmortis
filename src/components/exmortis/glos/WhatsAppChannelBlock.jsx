import React from "react";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { waChannel, WHATSAPP_CHANNEL } from "@/lib/whatsappChannel";
import WhatsAppChannelLink from "@/components/exmortis/WhatsAppChannelLink";

// /glos — blok kanału WhatsApp (wstrzykiwany kodem po muzyce i podcastach).
// Bez ustawionego adresu cała sekcja się nie pokazuje.
export default function WhatsAppChannelBlock() {
  const { str } = useSiteContent();
  if (!waChannel(str("contact", "whatsapp", WHATSAPP_CHANNEL))) return null;

  return (
    <section aria-labelledby="glos-whatsapp" className="py-20 md:py-28 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <p className="technical text-[11px] gold-text mb-4">KANAŁ WHATSAPP</p>
          <h2 id="glos-whatsapp" className="relic-heading text-3xl md:text-4xl text-[#F5EFE1] leading-[1.05] mb-4">
            Głos między poniedziałkami
          </h2>
          <p className="text-lg text-foreground/60 leading-relaxed mb-8">
            Krótkie wiadomości głosowe — kilka minut, bez spamu. Słuchasz, kiedy chcesz.
          </p>
          <WhatsAppChannelLink miejsce="glos" label="DOŁĄCZ" />
        </div>
      </div>
    </section>
  );
}