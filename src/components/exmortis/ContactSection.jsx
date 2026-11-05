import React, { useState } from "react";
import { useAccountPrefill, AccountContactLine, SignInHint } from "@/components/common/AccountContact";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Mail, Instagram, Facebook, Youtube } from "lucide-react";
import { sendForm } from "@/lib/outbox";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import useSystemText from "@/content/useSystemText";
import { track } from "@/lib/track";
import { useCrisis } from "@/components/crisis/CrisisContext";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import WhatsAppChannelLink from "@/components/exmortis/WhatsAppChannelLink";

// Wklej tu linki do swoich profili. Kanał WhatsApp ma osobny przycisk pod ikonami —
// adres z jednego źródła (lib/whatsappChannel.js), nie tutaj.
const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/e.x.m.o.r.t.i.s/", icon: Instagram },
  { label: "Facebook", url: "https://www.facebook.com/dawidkowalczyk.exmortis", icon: Facebook },
  { label: "YouTube", url: "https://www.youtube.com/@e.x.m.o.r.t.i.s", icon: Youtube },
];

export default function ContactSection({ label } = {}) {
  const { rich } = useSiteContent();
  const heading = rich("contact", "heading", 'Napisz.<br /><span class="gold-text">Odpowiadam sam.</span>');
  const intro = rich("contact", "intro", "Nie ma botów i asystentów. Jeśli jesteś na progu — napisz pierwszy ruch, choćby jednym zdaniem.");
  const { open: openCrisis } = useCrisis();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  // Zalogowana osoba: imię i e-mail z konta; „zmień” pokazuje pola.
  const acc = useAccountPrefill((a) => setForm((f) => ({ ...f, name: f.name || a.firstName, email: f.email || a.email })));
  const [manual, setManual] = useState(false);
  const fromAccount = acc.signedIn && !manual;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useSystemText();
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await sendForm("createContactMessage", form);
      track("Lead", { content_name: "kontakt" });
      setSent(true);
      if (res?.pilne) openCrisis();
      setForm({ name: acc.firstName || "", email: acc.email || "", message: "" });
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się wysłać. Spróbuj ponownie albo napisz bezpośrednio na kontakt@exmortis.pl");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="kontakt" className="py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px] grid md:grid-cols-2 gap-12 md:gap-20">
        {/* Lewa kolumna — kanały kontaktu */}
        <div>
          <p className="technical text-[11px] gold-text mb-4">{label || "KONTAKT · 10"}</p>
          <h2 className="relic-heading text-4xl lg:text-5xl xl:text-6xl mb-6 leading-[0.95] [overflow-wrap:break-word]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(heading) }} />
          <div className="rich-content text-foreground/60 text-lg leading-relaxed max-w-md mb-12" dangerouslySetInnerHTML={{ __html: sanitizeHtml(intro) }} />

          <div className="space-y-6">
            <a
              href="mailto:kontakt@exmortis.pl"
              className="flex items-center gap-4 group"
            >
              <span className="w-12 h-12 border hairline flex items-center justify-center group-hover:border-[#C9A24A] transition-colors">
                <Mail className="h-5 w-5 text-foreground/70 group-hover:gold-text transition-colors" />
              </span>
              <span>
                <span className="technical text-[9px] text-foreground/55 block mb-1">EMAIL</span>
                <span className="font-mono text-sm text-foreground/80 group-hover:gold-text transition-colors">
                  kontakt@exmortis.pl
                </span>
              </span>
            </a>

            <div className="flex items-center gap-4">
              <span className="technical text-[9px] text-foreground/55">SOCIAL MEDIA</span>
              <div className="flex gap-3">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={s.label}
                    className="w-11 h-11 border hairline flex items-center justify-center hover:border-[#C9A24A] transition-colors"
                  >
                    <s.icon className="h-4 w-4 text-foreground/70 hover:gold-text transition-colors" />
                  </a>
                ))}
              </div>
            </div>

            {/* Kanał WhatsApp — podpisany przycisk zamiast samej ikony. */}
            <WhatsAppChannelLink miejsce="kontakt" label="KANAŁ WHATSAPP" caption="głos między poniedziałkami" framed />
          </div>
        </div>

        {/* Prawa kolumna — formularz */}
        <div>
          {sent ? (
            <div className="border border-[#C9A24A]/40 p-10 flex flex-col items-center justify-center text-center gap-6 h-full">
              <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
                <Check className="h-7 w-7 gold-text" />
              </div>
              <p className="relic-heading text-2xl gold-text">{t("dz.kontakt.tytul")}</p>
              <p className="text-foreground/60 leading-relaxed">{t("dz.kontakt")}</p>
              <button
                onClick={() => setSent(false)}
                className="btn-ghost"
              >
                NAPISZ KOLEJNĄ
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              {fromAccount && <AccountContactLine email={acc.email} lead="Odpowiem na:" onChange={() => setManual(true)} />}
              <div className={`grid gap-6 ${fromAccount ? "" : "sm:grid-cols-2"}`}>
                {(!fromAccount || !acc.firstName) && <div>
                  <label className="technical text-[10px] text-foreground/55 block mb-3">IMIĘ</label>
                  <input
                    required
                    maxLength={200}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                  />
                </div>}
                {!fromAccount && <div>
                  <label className="technical text-[10px] text-foreground/55 block mb-3">EMAIL</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                  />
                </div>}
              </div>
              <div>
                <label className="technical text-[10px] text-foreground/55 block mb-3">WIADOMOŚĆ</label>
                <textarea
                  required
                  rows={5}
                  maxLength={10000}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors resize-none"
                />
                <span className="block text-right text-xs mt-1 text-foreground/55">{form.message.length} / 10000</span>
              </div>
              <p className="text-xs text-foreground/60 leading-relaxed">
                Administratorem danych jest Dawid Kowalczyk (EXMORTIS). Przetwarzam je, aby odpowiedzieć na Twoją wiadomość.
                Szczegóły i Twoje prawa: <Link to="/polityka-prywatnosci" className="gold-text underline">Polityka prywatności</Link>.
              </p>
              {error && <p role="alert" className="text-sm blood-text">{error}</p>}
              <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
                {sending ? "WYSYŁAM..." : "WYŚLIJ WIADOMOŚĆ"}{" "}
                {!sending && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="technical text-[10px] text-foreground/55">
                Twoja wiadomość ląduje tylko u mnie. Nikt jej nie zobaczy poza nami.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}