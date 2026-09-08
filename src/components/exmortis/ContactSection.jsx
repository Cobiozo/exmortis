import React, { useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await base44.entities.ContactMessage.create(form);
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
        <div>
          <p className="technical text-[11px] gold-text mb-4">KONTAKT · 08</p>
          <h2 className="relic-heading text-4xl md:text-6xl mb-6 leading-[0.95]">
            Napisz.<br /><span className="gold-text">Odpowiadam sam.</span>
          </h2>
          <p className="text-foreground/60 text-lg leading-relaxed max-w-md mb-10">
            Nie ma botów i asystentów. Jeśli jesteś na progu — napisz pierwszy ruch,
            choćby jednym zdaniem.
          </p>
          <a
            href="mailto:kontakt@exmortis.pl"
            className="flex items-center gap-3 text-foreground/70 hover:gold-text transition-colors"
          >
            <Mail className="h-4 w-4" />
            <span className="font-mono text-sm">kontakt@exmortis.pl</span>
          </a>
        </div>

        {sent ? (
          <div className="border border-[#C9A24A]/40 p-10 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
              <Check className="h-7 w-7 gold-text" />
            </div>
            <p className="relic-heading text-2xl gold-text">Wiadomość dotarła</p>
            <p className="text-foreground/60 leading-relaxed">
              Odpowiadam osobiście, zwykle w ciągu 48 godzin. Do zobaczenia na drodze.
            </p>
            <button onClick={() => setSent(false)} className="btn-ghost">
              NAPISZ KOLEJNĄ
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
    </section>
  );
}