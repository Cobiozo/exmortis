import React, { useState } from "react";
import { ArrowRight, Check, Mail, Instagram, Facebook, Youtube, PenLine } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useSiteContent } from "@/components/exmortis/SiteContentProvider";

// Wklej tu linki do swoich profili
const SOCIAL_LINKS = [
  { label: "Instagram", url: "https://www.instagram.com/e.x.m.o.r.t.i.s/", icon: Instagram },
  { label: "Facebook", url: "https://www.facebook.com/dawidkowalczyk.exmortis", icon: Facebook },
  { label: "YouTube", url: "https://www.youtube.com/@e.x.m.o.r.t.i.s", icon: Youtube },
];

export default function ContactSection() {
  const { rich } = useSiteContent();
  const heading = rich("contact", "heading", 'Napisz.<br /><span class="gold-text">Odpowiadam sam.</span>');
  const intro = rich("contact", "intro", "Nie ma botów i asystentów. Jeśli jesteś na progu — napisz pierwszy ruch, choćby jednym zdaniem.");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("createContactMessage", form);
      setSent(true);
      setForm({ name: "", email: "", message: "" });
    } catch {
      setError("Nie udało się wysłać. Spróbuj ponownie albo napisz bezpośrednio na kontakt@exmortis.pl");
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="kontakt" className="py-32 px-5 md:px-10 border-t hairline bg-[#070708]">
      <div className="mx-auto max-w-[1400px] grid md:grid-cols-2 gap-12 md:gap-20">
        {/* Lewa kolumna — kanały kontaktu */}
        <div>
          <p className="technical text-[11px] gold-text mb-4">KONTAKT · 09</p>
          <h2 className="relic-heading text-4xl md:text-5xl lg:text-6xl mb-6 leading-[0.95]" dangerouslySetInnerHTML={{ __html: heading }} />
          <div className="rich-content text-foreground/60 text-lg leading-relaxed max-w-md mb-12" dangerouslySetInnerHTML={{ __html: intro }} />

          <div className="space-y-6">
            <a
              href="mailto:kontakt@exmortis.pl"
              className="flex items-center gap-4 group"
            >
              <span className="w-12 h-12 border hairline flex items-center justify-center group-hover:border-[#C9A24A] transition-colors">
                <Mail className="h-5 w-5 text-foreground/70 group-hover:gold-text transition-colors" />
              </span>
              <span>
                <span className="technical text-[9px] text-foreground/40 block mb-1">EMAIL</span>
                <span className="font-mono text-sm text-foreground/80 group-hover:gold-text transition-colors">
                  kontakt@exmortis.pl
                </span>
              </span>
            </a>

            <div className="flex items-center gap-4">
              <span className="technical text-[9px] text-foreground/40">SOCIAL MEDIA</span>
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
              <p className="relic-heading text-2xl gold-text">Wiadomość dotarła</p>
              <p className="text-foreground/60 leading-relaxed">
                Odpowiadam osobiście, zwykle w ciągu 48 godzin. Do zobaczenia na drodze.
              </p>
              <button
                onClick={() => { setSent(false); setShowForm(true); }}
                className="btn-ghost"
              >
                NAPISZ KOLEJNĄ
              </button>
            </div>
          ) : !showForm ? (
            <div className="border hairline p-10 md:p-14 flex flex-col items-center justify-center text-center gap-8 h-full">
              <span className="w-14 h-14 border border-[#C9A24A]/40 flex items-center justify-center">
                <PenLine className="h-6 w-6 gold-text" />
              </span>
              <p className="relic-heading text-2xl md:text-3xl leading-tight">
                Formularz czeka<br /><span className="gold-text">za jednym kliknięciem</span>
              </p>
              <p className="text-foreground/50 text-sm leading-relaxed max-w-sm">
                Trzy pola. Jedna wiadomość. Zero zobowiązań — dopóki sam nie zdecydujesz.
              </p>
              <button onClick={() => setShowForm(true)} className="btn-relic">
                NAPISZ DO MNIE <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="technical text-[10px] text-foreground/50 block mb-3">IMIĘ</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="technical text-[10px] text-foreground/50 block mb-3">EMAIL</label>
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
                <label className="technical text-[10px] text-foreground/50 block mb-3">WIADOMOŚĆ</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors resize-none"
                />
              </div>
              {error && <p className="text-sm blood-text">{error}</p>}
              <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
                {sending ? "WYSYŁAM..." : "WYŚLIJ WIADOMOŚĆ"}{" "}
                {!sending && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="technical text-[10px] text-foreground/40">
                Twoja wiadomość ląduje tylko u mnie. Nikt jej nie zobaczy poza nami.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}