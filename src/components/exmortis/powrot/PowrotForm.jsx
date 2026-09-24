import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Section from "./Section";

export default function PowrotForm() {
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("createPowrotApplication", form);
      setSent(true);
    } catch {
      setError("Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section dark id="formularz" label="ZGŁOSZENIE">
      <div className="grid md:grid-cols-2 gap-12 md:gap-20">
        <div>
          <h2 className="relic-heading text-4xl md:text-6xl leading-[0.95] mb-6">
            Formularz<br /><span className="gold-text">kwalifikacyjny</span>
          </h2>
          <p className="text-foreground/60 leading-relaxed max-w-md">
            Trzy pola. Kilka pytań zadasz sobie sam. Zgłoszenia rozpatruję
            w kolejności napływania — odezwę się osobiście.
          </p>
          <p className="technical text-[10px] text-foreground/40 mt-8">
            ROZMOWA KWALIFIKACYJNA · BEZPŁATNA · BEZ ZOBOWIĄZAŃ
          </p>
        </div>
        <div>
          <p className="text-foreground/50 text-sm mb-8">
            Nie wiesz, czy to dla Ciebie? Zacznij od{" "}
            <Link to="/test?src=powrot" className="gold-text hover:underline">
              testu «Która śmierć jest Twoja?»
            </Link>
          </p>
          {sent ? (
            <div className="border border-[#C9A24A]/40 p-10 flex flex-col items-center justify-center text-center gap-6 h-full">
              <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
                <Check className="h-7 w-7 gold-text" />
              </div>
              <p className="relic-heading text-2xl gold-text">Zgłoszenie przyjęte</p>
              <p className="text-foreground/60 leading-relaxed">
                Rozpatruję zgłoszenia w kolejności napływania. Odezwę się osobiście,
                żeby umówić rozmowę kwalifikacyjną.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-3">IMIĘ I NAZWISKO</label>
                <input
                  required
                  value={form.full_name}
                  onChange={set("full_name")}
                  className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-3">NR TELEFONU</label>
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-3">EMAIL</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
                />
              </div>
              {error && <p className="text-sm blood-text">{error}</p>}
              <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
                {sending ? "WYSYŁAM..." : "WYŚLIJ ZGŁOSZENIE"}{" "}
                {!sending && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}