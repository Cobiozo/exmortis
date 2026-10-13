import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import useSystemText from "@/content/useSystemText";

// Sekcja „Listy powrotu" (newsletter) na stronie głównej — podpis pod kontakt.
export default function NewsletterSection() {
  const { rich } = useSiteContent();
  const title = rich("footer", "newsletterTitle", 'Zapisz się.<br /><span class="blood-text">Wracaj</span> co tydzień.');
  const desc = rich("footer", "newsletterDesc", "Jeden list tygodniowo. Jeden temat powrotu. Jedno narzędzie. Prosto na Twój mail — z prezentem powitalnym: mini-PDF „3 pierwsze ruchy powrotu”.");
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
      setSent(true);
      setEmail("");
      setTimeout(() => setSent(false), 5000);
    } catch {
      setError("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="listy-powrotu" className="py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px] grid md:grid-cols-2 gap-12 md:gap-20 items-center">
        <div>
          <p className="technical text-[11px] gold-text mb-4">LISTY POWROTU · 09</p>
          <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl leading-[0.95] mb-6" dangerouslySetInnerHTML={{ __html: title }} />
          <div className="rich-content text-foreground/60 text-lg max-w-md leading-relaxed" dangerouslySetInnerHTML={{ __html: desc }} />
        </div>
        <div>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twój.mail@powrotu.pl"
                className="flex-1 min-w-0 bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors"
              />
              <button type="submit" disabled={sending} className="btn-relic whitespace-nowrap disabled:opacity-60">
                {sending ? "ZAPISUJĘ..." : "ZAPISZ"} {!sending && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
            {sent && (
              <p className="technical text-[10px] gold-text">✓ {t("dz.listy")}</p>
            )}
            {error && <p className="technical text-[10px] blood-text">{error}</p>}
            <p className="technical text-[10px] text-foreground/40">
              Bez spamu. Tylko powrót. Wypisujesz jednym kliknięciem.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}