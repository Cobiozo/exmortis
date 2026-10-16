import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Mail, Instagram, Facebook, Youtube, MessageCircle } from "lucide-react";
import { sendForm } from "@/lib/outbox";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";
import useSystemText from "@/content/useSystemText";
import { track } from "@/lib/track";
import { useCrisis } from "@/components/crisis/CrisisContext";
import { sanitizeHtml } from "@/lib/sanitizeHtml";

// Wklej tu linki do swoich profili
const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/e.x.m.o.r.t.i.s/", icon: Instagram },
  { label: "Facebook", url: "https://www.facebook.com/dawidkowalczyk.exmortis", icon: Facebook },
  { label: "YouTube", url: "https://www.youtube.com/@e.x.m.o.r.t.i.s", icon: Youtube },
  { label: "Kanał WhatsApp", url: "https://whatsapp.com/channel/0029VbDYXi1Lo4hfFPvT3O3G", icon: MessageCircle },
];

export default function ContactSection() {
  const { rich } = useSiteContent();
  const heading = rich("contact", "heading", 'Napisz.<br /><span class="gold-text">Odpowiadam sam.</span>');
  const intro = rich("contact", "intro", "Nie ma botów i asystentów. Jeśli jesteś na progu — napisz pierwszy ruch, choćby jednym zdaniem.");
  const { open: openCrisis } = useCrisis();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useSystemText();
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentErr, setConsentErr] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) {
      setConsentErr(true);
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await sendForm("createContactMessage", form);
      track("Lead", { content_name: "kontakt" });
      setSent(true);
      if (res?.pilne) openCrisis();
      setForm({ name: "", email: "", message: "" });
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
          <p className="technical text-[11px] gold-text mb-4">KONTAKT · 10</p>
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
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="technical text-[10px] text-foreground/55 block mb-3">IMIĘ</label>
                  <input
                    required
                    maxLength={200}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="technical text-[10px] text-foreground/55 block mb-3">EMAIL</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                  />
                </div>
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
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setConsentErr(false); }}
                  aria-required="true"
                  aria-invalid={consentErr}
                  aria-describedby={consentErr ? "ct-consent-err" : undefined}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]"
                />
                <span className="text-sm text-foreground/80 leading-relaxed group-hover:text-foreground transition-colors">
                  Akceptuję <Link to="/regulamin" className="gold-text underline">regulamin</Link> i{" "}
                  <Link to="/polityka-prywatnosci" className="gold-text underline">politykę prywatności</Link>.
                </span>
              </label>
              {consentErr && <p id="ct-consent-err" role="alert" className="-mt-3 text-sm text-[#E8C547]">Zaznacz, żeby wysłać wiadomość.</p>}
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