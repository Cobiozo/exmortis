import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Formularz zapisu na wydarzenie (strona wydarzenia): imię, e-mail, pytanie, zgoda.
export default function RegistrationForm({ event: ev }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (result && result.checkout_url) {
      const t = setTimeout(() => {
        window.location.href = result.checkout_url;
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [result]);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    if (!consent) {
      setError("Potrzebuję Twojej zgody, żeby zapisać Cię na spotkanie.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const src = new URLSearchParams(window.location.search).get("src") || "";
      const res = await base44.functions.invoke("eventsPublic", {
        action: "register",
        slug: ev.slug,
        first_name: firstName,
        email,
        question,
        consent: true,
        source: src,
      });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setSending(false);
    }
  };

  if (result) {
    if (result.already) {
      return (
        <p className="text-foreground/70 leading-relaxed border border-[#C9A24A]/30 p-6">
          Jesteś już zapisany/a na to spotkanie. Link wyślę Ci e-mailem przed rozpoczęciem.
        </p>
      );
    }
    if (result.status === "Lista rezerwowa") {
      return (
        <p className="text-foreground/70 leading-relaxed border border-[#5C1A1B] bg-[#0D0D0E] p-6">
          Wszystkie miejsca są zajęte. Zapisałem Cię na listę rezerwową — dam znać, jeśli ktoś zrezygnuje.
        </p>
      );
    }
    return (
      <div className="border border-[#C9A24A]/40 bg-[#0D0D0E] p-8">
        <p className="shop-heading text-xl text-[#F5EFE1]">
          Dziękuję, {result.first_name || firstName}. Jesteś zapisany/a.
        </p>
        <p className="text-foreground/60 mt-3 leading-relaxed">Link do spotkania wyślę Ci e-mailem.</p>
        {result.checkout_url && (
          <p className="technical text-[10px] gold-text mt-5">ZA CHWILĘ PROWADZĘ CIĘ DO PŁATNOŚCI…</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-5">
        <input
          type="text"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Imię"
          className="bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors"
        />
      </div>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Czy jest pytanie, które chcesz mi zadać? (opcjonalnie)"
        className="w-full bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-sm focus:border-[#C9A24A] focus:outline-none transition-colors resize-none"
      />
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 accent-[#C9A24A]"
        />
        <span className="text-xs text-foreground/50 leading-relaxed group-hover:text-foreground/70 transition-colors">
          Zgadzam się na przetwarzanie danych w celu udziału w spotkaniu.
        </span>
      </label>
      {error && <p className="technical text-[10px] blood-text">{error}</p>}
      <button type="submit" disabled={sending} className="btn-relic disabled:opacity-60">
        {sending ? "ZAPISUJĘ..." : "ZAPISUJĘ SIĘ"}
      </button>
    </form>
  );
}