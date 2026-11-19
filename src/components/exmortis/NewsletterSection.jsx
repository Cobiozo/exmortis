import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import useSystemText from "@/content/useSystemText";
import { track } from "@/lib/track";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import WhatsAppChannelLink from "@/components/exmortis/WhatsAppChannelLink";
import Section from "@/components/exmortis/ui/Section";
import Container from "@/components/exmortis/ui/Container";

// „Listy powrotu” (etap 2, 18.11.2026) — wygląd w stylu marki na tle bordowym.
// Logika zapisu, potwierdzenie i kanał WhatsApp bez zmian.
export default function NewsletterSection({ label } = {}) {
  const { rich } = useSiteContent();
  const title = rich("footer", "newsletterTitle", 'Słowo na drogę.<br /><span class="gold-text">Prosto do skrzynki.</span>');
  const desc = rich("footer", "newsletterDesc", "Piszę o tym, co pomaga wracać: historie, myśli i pytania, które warto sobie zadać. Na początek wyślę Ci prezent powitalny: mini-PDF „3 pierwsze ruchy powrotu”.");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const t = useSystemText();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("subscribeNewsletter", { email });
      track("Lead", { content_name: "newsletter" });
      setSent(true);
      setEmail("");
      // Popupy „bez subskrybentów” nie pokazują się już w tej przeglądarce.
      try { localStorage.setItem("exm_sub", "1"); } catch { /* brak pamięci */ }
      // Potwierdzenie zostaje na ekranie — pod nim jest zaproszenie do kanału WhatsApp.
    } catch {
      setError("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section id="listy-powrotu" tone="bordo">
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <p className="exm-eyebrow mb-3">{label || "LISTY POWROTU"}</p>
            <h2 className="exm-h2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(title) }} />
            <div className="rich-content mt-4 max-w-md text-[17px] leading-relaxed text-exm-text/85" dangerouslySetInnerHTML={{ __html: sanitizeHtml(desc) }} />
            {/* Kod za zapis (19.11.2026) — wydaje go subscribeNewsletter po potwierdzeniu adresu (_shared/listyCode.ts). */}
            <div className="mt-6 max-w-md rounded-[var(--exm-r-field)] border border-exm-gold/40 bg-exm-bg/30 px-4 py-3">
              <p className="text-[15px] leading-relaxed text-exm-ivory">
                <span className="text-exm-gold">−10 zł na start.</span> Po potwierdzeniu zapisu dostajesz jednorazowy kod na e-booki i inne materiały ze Skarbca.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-exm-muted">Kod jest ważny 30 dni. Nie dotyczy programu POWRÓT ani Rozmowy na progu.</p>
            </div>
          </div>

          <div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="newsletter-email" className="technical mb-2 block text-[10px] text-exm-text/80">
                  Twój adres e-mail
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="newsletter-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="twój.mail@powrotu.pl"
                    className="min-w-0 flex-1 rounded-[var(--exm-r-field)] border border-exm-line-strong bg-exm-bg/60 px-4 py-3 text-exm-ivory placeholder:text-exm-muted/70 focus:border-exm-gold focus:outline-none"
                  />
                  <button type="submit" disabled={sending} className="btn-relic whitespace-nowrap disabled:opacity-60">
                    {sending ? "Zapisuję…" : "Zapisz się"} {!sending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {sent && (
                <div className="space-y-3 rounded-[var(--exm-r-field)] border border-exm-gold/40 p-4">
                  <p className="technical text-[10px] text-exm-gold">✓ {t("dz.listy")}</p>
                  <p className="text-sm leading-relaxed text-exm-text/85">
                    Potwierdź zapis w wiadomości, którą dostaniesz na skrzynkę. Zaraz po potwierdzeniu wyślę Ci kod −10 zł.
                  </p>
                  <p className="text-sm leading-relaxed text-exm-text/75">
                    Między listami nagrywam krótkie wiadomości głosowe. Jeśli chcesz słyszeć mnie częściej — dołącz do kanału WhatsApp.
                  </p>
                  <WhatsAppChannelLink miejsce="po_zapisie" />
                </div>
              )}

              {error && <p role="alert" className="technical text-[10px] text-exm-ivory">{error}</p>}

              <p className="text-[13px] leading-relaxed text-exm-text/75">
                Wypisujesz się jednym kliknięciem. Zasady przetwarzania danych opisuję w{" "}
                <Link to="/polityka-prywatnosci" className="underline decoration-exm-gold/60 underline-offset-4 hover:text-exm-ivory">
                  Polityce prywatności
                </Link>.
              </p>
            </form>
          </div>
        </div>
      </Container>
    </Section>
  );
}