import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

const EMPTY = { full_name: "", phone: "", email: "", motivation: "", story: "" };

export default function PodcastGuestForm() {
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await base44.entities.PodcastApplication.create(form);
      setSent(true);
    } catch {
      setError("Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="border border-[#C9A24A]/40 p-10 flex flex-col items-center justify-center text-center gap-6 h-full">
        <div className="w-14 h-14 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
          <Check className="h-7 w-7 gold-text" />
        </div>
        <p className="relic-heading text-2xl gold-text">Zgłoszenie przyjęte</p>
        <p className="text-foreground/60 leading-relaxed">
          Dziękuję za odwagę i zaufanie. Uważnie przeczytam Twoją historię i odezwę się,
          jeśli wybiorę ją do nagrania.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-6">
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
          <label className="technical text-[10px] text-foreground/50 block mb-3">NUMER TELEFONU</label>
          <input
            required
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
          />
        </div>
      </div>
      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-3">ADRES E-MAIL</label>
        <input
          required
          type="email"
          value={form.email}
          onChange={set("email")}
          className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
        />
      </div>
      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-3">
          DLACZEGO CHCESZ WYSTĄPIĆ W NASZYM PODCAŚCIE?
        </label>
        <textarea
          required
          rows={3}
          value={form.motivation}
          onChange={set("motivation")}
          placeholder="Jaka jest Twoja główna motywacja do wzięcia udziału w nagraniu?"
          className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors resize-none placeholder:text-foreground/30"
        />
      </div>
      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-3">
          CZYM CHCESZ SIĘ PODZIELIĆ? (KRÓTKO OPISZ SWOJĄ HISTORIĘ)
        </label>
        <textarea
          required
          rows={4}
          value={form.story}
          onChange={set("story")}
          placeholder="W kilku zdaniach przedstaw swoją „drogę powrotu”, momenty przełomowe oraz to, co najważniejszego wyniosłeś ze swojego doświadczenia."
          className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors resize-none placeholder:text-foreground/30"
        />
      </div>
      {error && <p className="text-sm blood-text">{error}</p>}
      <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
        {sending ? "WYSYŁAM..." : "WYŚLIJ ZGŁOSZENIE"}{" "}
        {!sending && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="technical text-[10px] text-foreground/40">
        Gwarantuję pełną poufność przekazanych informacji.
      </p>
    </form>
  );
}