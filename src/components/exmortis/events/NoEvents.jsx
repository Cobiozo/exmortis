import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Pusta lista wydarzeń: spokojny tekst + zapis na Listy powrotu.
export default function NoEvents() {
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
    } catch {
      setError("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto text-center">
      <p className="shop-heading text-2xl md:text-3xl text-[#F5EFE1] leading-snug">
        Najbliższe spotkanie ogłoszę w Listach powrotu.
      </p>

      <form onSubmit={submit} className="mt-12 flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="twój.mail@powrotu.pl"
          className="flex-1 bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors"
        />
        <button type="submit" disabled={sending} className="btn-relic whitespace-nowrap disabled:opacity-60">
          {sending ? "ZAPISUJĘ..." : "ZAPISZ MNIE"} {!sending && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
      {sent && <p className="technical text-[10px] gold-text mt-5">✓ Rejestracja przyjęta. Sprawdź skrzynkę.</p>}
      {error && <p className="technical text-[10px] blood-text mt-5">{error}</p>}
    </div>
  );
}