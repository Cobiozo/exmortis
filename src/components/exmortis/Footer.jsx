import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Logo from "./Logo";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
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
    <footer className="relative bg-[#0A0A0B] border-t hairline overflow-hidden">
      {/* Blood-trail top line */}
      <div className="absolute top-0 left-0 right-0 h-px spine" />

      <div className="mx-auto max-w-[1400px] px-5 md:px-10 py-20 md:py-28">
        {/* Newsletter — Survival Registration */}
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 pb-20 border-b hairline">
          <div>
            <p className="technical text-[11px] gold-text mb-4">LISTY POWROTU · NEWSLETTER</p>
            <h2 className="relic-heading text-3xl md:text-5xl leading-[0.95]">
              Zapisz się.<br />
              <span className="blood-text">Wracaj</span> co tydzień.
            </h2>
            <p className="mt-6 text-foreground/60 max-w-md leading-relaxed">
              Jeden list tygodniowo. Jeden temat powrotu. Jedno narzędzie. Prosto na Twój mail —
              z prezentem powitalnym: mini-PDF „3 pierwsze ruchy powrotu".
            </p>
          </div>
          <div className="flex flex-col justify-center">
            <form onSubmit={submit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twój.mail@powrotu.pl"
                  className="flex-1 bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors"
                />
                <button type="submit" disabled={sending} className="btn-relic whitespace-nowrap disabled:opacity-60">
                  {sending ? "ZAPISUJĘ..." : "ZAPISZ"} {!sending && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
              {sent && (
                <p className="technical text-[10px] gold-text">
                  ✓ Rejestracja przyjęta. Sprawdź skrzynkę.
                </p>
              )}
              {error && <p className="technical text-[10px] blood-text">{error}</p>}
              <p className="technical text-[10px] text-foreground/40">
                Bez spamu. Tylko powrót. Wypisujesz jednym kliknięciem.
              </p>
            </form>
          </div>
        </div>

        {/* Lower grid */}
        <div className="grid md:grid-cols-4 gap-10 pt-16">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <Logo className="h-12 w-12" glow={false} />
              <span className="relic-heading text-2xl gold-text tracking-[0.3em]">EXMORTIS</span>
            </div>
            <p className="text-foreground/50 max-w-sm leading-relaxed text-sm">
              Wracam z siebie. Uczę wracać. Głos powrotu ze śmierci mentalnej, duchowej
              i życiowej. Nie musisz być silny, żeby wrócić. Musisz zrobić pierwszy ruch.
            </p>
          </div>

          <div>
            <p className="technical text-[10px] text-foreground/40 mb-5">Nawigacja</p>
            <ul className="space-y-3 text-sm">
              <li><Link to="/" className="text-foreground/70 hover:gold-text transition-colors">Powrót</Link></li>
              <li><Link to="/o-mnie" className="text-foreground/70 hover:gold-text transition-colors">O mnie</Link></li>
              <li><Link to="/sklep" className="text-foreground/70 hover:gold-text transition-colors">Sklep</Link></li>
              <li><a href="#manifest" className="text-foreground/70 hover:gold-text transition-colors">Manifest</a></li>
            </ul>
          </div>

          <div>
            <p className="technical text-[10px] text-foreground/40 mb-5">Kontakt</p>
            <ul className="space-y-3 text-sm">
              <li><a href="mailto:kontakt@exmortis.pl" className="text-foreground/70 hover:gold-text transition-colors">kontakt@exmortis.pl</a></li>
              <li><a href="https://www.instagram.com/e.x.m.o.r.t.i.s/" target="_blank" rel="noreferrer" className="text-foreground/70 hover:gold-text transition-colors">Instagram</a></li>
              <li><a href="https://www.facebook.com/dawidkowalczyk.exmortis" target="_blank" rel="noreferrer" className="text-foreground/70 hover:gold-text transition-colors">Facebook</a></li>
              <li><a href="https://www.youtube.com/@e.x.m.o.r.t.i.s" target="_blank" rel="noreferrer" className="text-foreground/70 hover:gold-text transition-colors">YouTube</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t hairline flex flex-col sm:flex-row justify-between gap-4">
          <p className="technical text-[10px] text-foreground/30">
            © {new Date().getFullYear()} EXMORTIS · WSZELKIE PRAWA ZASTRZEŻONE
          </p>
          <p className="technical text-[10px] text-foreground/30">
            WRACAM Z SIEBIE · UCZĘ WRACAĆ
          </p>
        </div>
      </div>
    </footer>
  );
}