import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import useSystemText from "@/content/useSystemText";

// Formularz zapisu na wydarzenie (strona wydarzenia): imię, e-mail, pytanie, zgoda.
export default function RegistrationForm({ event: ev }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const t = useSystemText();
  const [listy, setListy] = useState(false);
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
      const params = new URLSearchParams(window.location.search);
      const src = params.get("src") || params.get("utm_source") || "";
      const res = await base44.functions.invoke("eventsPublic", {
        action: "register",
        slug: ev.slug,
        first_name: firstName,
        email,
        question,
        consent: true,
        listy,
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
          {t("dz.spotkanie", { imie: result.first_name || firstName })}
        </p>
        {ev.what_registered && (
          <p className="text-foreground/60 text-sm mt-3 leading-relaxed">Co dostają zapisani: {ev.what_registered}</p>
        )}
        {result.join_link ? (
          <p className="text-foreground/70 mt-4 leading-relaxed break-all">
            Link do spotkania:{" "}
            <a href={result.join_link} target="_blank" rel="noreferrer" className="gold-text underline">
              {result.join_link}
            </a>
          </p>
        ) : (
          <p className="text-foreground/60 mt-4 leading-relaxed">Link do spotkania wyślę Ci e-mailem.</p>
        )}
        {result.join_password && (
          <p className="text-foreground/50 text-sm mt-1">Hasło do spotkania: {result.join_password}</p>
        )}
        {result.checkout_url && (
          <p className="technical text-[10px] gold-text mt-5">ZA CHWILĘ PROWADZĘ CIĘ DO PŁATNOŚCI…</p>
        )}
      </div>
    );
  }

  // Zapisy zamknięte — po terminie zapisów (domyślnie 15 min przed startem).
  const deadline = ev.registration_deadline
    ? new Date(ev.registration_deadline)
    : ev.start_datetime
      ? new Date(new Date(ev.start_datetime).getTime() - 15 * 60000)
      : null;
  if (deadline && new Date() > deadline) {
    return (
      <div className="border hairline p-8 text-center">
        <p className="shop-heading text-xl text-[#F5EFE1]">Zapisy zamknięte.</p>
        {ev.external_url && (
          <a href={ev.external_url} target="_blank" rel="noreferrer" className="btn-relic mt-6">
            DOŁĄCZ DO TRANSMISJI
          </a>
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
          className="bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-base min-h-[48px] w-full focus:border-[#C9A24A] focus:outline-none transition-colors"
        />
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-base min-h-[48px] w-full focus:border-[#C9A24A] focus:outline-none transition-colors"
        />
      </div>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Czy jest pytanie, które chcesz mi zadać? (opcjonalnie)"
        className="w-full bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-base min-h-[48px] w-full focus:border-[#C9A24A] focus:outline-none transition-colors resize-none"
      />
      <label className="flex items-start gap-3 cursor-pointer group py-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]"
        />
        <span className="text-xs text-foreground/50 leading-relaxed group-hover:text-foreground/70 transition-colors">
          Zapisuję się na to spotkanie i akceptuję{" "}
          <Link to="/polityka-prywatnosci" className="gold-text underline">
            politykę prywatności
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 cursor-pointer group py-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={listy}
          onChange={(e) => setListy(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]"
        />
        <span className="text-xs text-foreground/50 leading-relaxed group-hover:text-foreground/70 transition-colors">
          Chcę też dostawać Listy powrotu — jeden list w każdy poniedziałek.
        </span>
      </label>
      {error && <p className="technical text-[10px] blood-text">{error}</p>}
      <button type="submit" disabled={sending} className="btn-relic disabled:opacity-60">
        {sending ? "ZAPISUJĘ..." : "ZAPISUJĘ SIĘ"}
      </button>
    </form>
  );
}