import React from "react";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import { waChannel, WHATSAPP_CHANNEL } from "@/lib/whatsappChannel";
import WhatsAppChannelLink from "@/components/exmortis/WhatsAppChannelLink";
import Container from "@/components/exmortis/ui/Container";

// /glos — dyskretny pas przejścia: „Wolisz czytać?” (Listy powrotu) i kanał WhatsApp w jednej zwartej karcie.
// Adres kanału z jednego źródła; bez ustawionego adresu cały pas się nie pokazuje.
export default function WhatsAppChannelBlock() {
  const { str } = useSiteContent();
  if (!waChannel(str("contact", "whatsapp", WHATSAPP_CHANNEL))) return null;

  return (
    <section aria-labelledby="glos-whatsapp" className="py-10 md:py-14">
      <Container>
        <div className="grid gap-6 rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 md:grid-cols-2 md:items-center md:gap-8 md:p-8">
          <div className="min-w-0">
            <p className="exm-eyebrow mb-2">Wolisz czytać?</p>
            <p className="text-[15px] leading-relaxed text-exm-muted">Listy powrotu raz w tygodniu. Krótko, bez lukru.</p>
            <Link to="/#listy-powrotu" className="btn-link mt-1">Zapisz się na Listy powrotu</Link>
          </div>
          <div className="min-w-0 border-t border-exm-line pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <p className="exm-eyebrow mb-2">Kanał WhatsApp</p>
            <h2 id="glos-whatsapp" className="exm-h3">Głos między poniedziałkami</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-exm-muted">
              Krótkie wiadomości głosowe — kilka minut, bez spamu. Słuchasz, kiedy chcesz.
            </p>
            <div className="mt-4">
              <WhatsAppChannelLink miejsce="glos" label="Dołącz" framed />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}