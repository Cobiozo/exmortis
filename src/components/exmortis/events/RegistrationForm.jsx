import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sendForm } from "@/lib/outbox";
import useSystemText from "@/content/useSystemText";
import { useFirma } from "@/lib/useSiteSettings";
import { clause } from "@/lib/firma";
import { CalendarPlus } from "lucide-react";
import { downloadIcs } from "./time";
import { SITE_URL } from "@/config/site";

// Formularz zapisu na wydarzenie (strona wydarzenia): imię, e-mail, pytanie, zgoda.
export default function RegistrationForm({ event: ev }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const t = useSystemText();
  const [listy, setListy] = useState(false);
  const [consentErr, setConsentErr] = useState(false);
  const [website, setWebsite] = useState("");
  const firma = useFirma();
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
      setConsentErr(true);
      return;
    }
    setSending(true);
    setError("");
    try {
      const params = new URLSearchParams(window.location.search);
      const src = params.get("src") || params.get("utm_source") || "";
      const data = await sendForm("eventsPublic", {
        action: "register",
        slug: ev.slug,
        first_name: firstName,
        email,
        question,
        consent: true,
        listy,
        website,
        source: src,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      });
      setResult(data.queued ? { ok: true, status: "Zapisany", first_name: firstName, pending: true,
        join_url: ev.format === "Online" ? (ev.short_path ? `/${ev.short_path}/dolacz` : `/spotkania/${ev.slug}/dolacz`) : null } : data);
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
          Ten adres jest już zapisany — link przyjdzie e-mailem.
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
        {result.join_url ? (
          <p className="text-foreground/70 mt-4 leading-relaxed break-all">
            Link do dołączenia:{" "}
            <a href={result.join_url} className="gold-text underline">{SITE_URL}{result.join_url}</a>
            {" "}— zapisz go albo dodaj spotkanie do kalendarza.
          </p>
        ) : ev.format !== "Online" ? null : (
          <p className="text-foreground/60 mt-4 leading-relaxed">Link do spotkania wyślę Ci e-mailem.</p>
        )}
        {ev.start_datetime && (
          <button type="button" onClick={() => downloadIcs(ev)} className="btn-ghost !px-5 !py-3 mt-5">
            <CalendarPlus className="h-4 w-4" /> DODAJ DO KALENDARZA
          </button>
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
        <label htmlFor="reg-name" className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">IMIĘ</span>
          <input
            id="reg-name"
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Imię"
            className="bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-base min-h-[48px] w-full focus:border-[#C9A24A] focus:outline-none transition-colors"
          />
        </label>
        <label htmlFor="reg-email" className="block">
          <span className="block technical text-[10px] text-foreground/60 mb-2">E-MAIL</span>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="bg-transparent border hairline px-5 py-4 text-foreground placeholder:text-foreground/30 font-mono text-base min-h-[48px] w-full focus:border-[#C9A24A] focus:outline-none transition-colors"
          />
        </label>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="reg-web">Strona www</label>
        <input id="reg-web" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <label htmlFor="reg-q" className="block technical text-[10px] text-foreground/60 -mb-3">PYTANIE (NIEOBOWIĄZKOWO)</label>
      <textarea
        id="reg-q"
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
          onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setConsentErr(false); }}
          aria-required="true"
          aria-invalid={consentErr}
          aria-describedby={consentErr ? "reg-consent-err" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]"
        />
        <span className="text-sm text-foreground/80 leading-relaxed group-hover:text-foreground transition-colors">
          Akceptuję{" "}
          <Link to="/regulamin" className="gold-text underline">regulamin</Link>.
        </span>
      </label>
      {consentErr && <p id="reg-consent-err" role="alert" className="-mt-3 text-sm text-[#E8C547]">Zaznacz, żeby się zapisać.</p>}
      <label className="flex items-start gap-3 cursor-pointer group py-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={listy}
          onChange={(e) => setListy(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]"
        />
        <span className="text-sm text-foreground/80 leading-relaxed group-hover:text-foreground transition-colors">
          Chcę też dostawać Listy powrotu — jeden list w każdy poniedziałek.
        </span>
      </label>
      <p className="text-sm text-foreground/75 leading-relaxed">
        {clause("obsłużyć Twój udział w spotkaniu", "umowa", firma)} Szczegóły:{" "}
        <Link to="/polityka-prywatnosci" className="gold-text underline">polityka prywatności</Link>.
      </p>
      {error && <p className="technical text-[10px] blood-text">{error}</p>}
      <button type="submit" disabled={sending} aria-busy={sending} className="btn-relic disabled:opacity-60 disabled:cursor-wait">
        {sending ? "ZAPISUJĘ…" : "ZAPISUJĘ SIĘ"}
      </button>
    </form>
  );
}