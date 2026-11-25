import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sendForm } from "@/lib/outbox";
import useSystemText from "@/content/useSystemText";
import CalendarButtons from "./CalendarButtons";
import { track } from "@/lib/track";
import { visitSource } from "@/lib/firstTouch";
import { TXT } from "@/content/legal/seller";
import { useAccountContact, AccountContactLine, SignInHint } from "@/components/common/AccountContact";
import ConfirmEmailField, { sameEmail } from "@/components/common/ConfirmEmailField";

// Formularz zapisu na wydarzenie (strona wydarzenia): imię, e-mail, pytanie, zgoda.
export default function RegistrationForm({ event: ev }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const t = useSystemText();
  const [listy, setListy] = useState(false);
  const [consentErr, setConsentErr] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  // Zalogowana osoba: imię i e-mail z konta (bez wpisywania); „zmień” pokazuje pola.
  const acc = useAccountContact();
  const [manual, setManual] = useState(false);
  const fromAccount = acc.signedIn && !manual;
  const nameOut = fromAccount && acc.firstName ? acc.firstName : firstName;
  const emailOut = fromAccount ? acc.email : email;

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
    // Adres wpisany ręcznie — drugi raz, bez wklejania (25.11.2026): link do spotkania musi dotrzeć.
    if (!fromAccount && !sameEmail(email, email2)) {
      setError("Adres e-mail i powtórzony adres się różnią. Popraw je — na ten adres wyślę link do spotkania.");
      document.getElementById("reg-email2")?.focus();
      return;
    }
    setSending(true);
    setError("");
    try {
      const src = visitSource();
      const data = await sendForm("eventsPublic", {
        action: "register",
        slug: ev.slug,
        first_name: nameOut,
        email: emailOut,
        question,
        consent: true,
        listy,
        website,
        source: src,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      });
      // Osobisty klucz dołączenia zapamiętany na tym urządzeniu — w dniu spotkania strona /dolacz wpuści bez wpisywania e-maila.
      try {
        const tk = new URL(data?.join_url || "", window.location.origin).searchParams.get("t");
        if (tk) [ev.slug, ev.short_path].filter(Boolean).forEach((k) => localStorage.setItem(`exm_join_t:${k}`, tk));
      } catch { /* bez pamięci przeglądarki */ }
      if (!data?.already) track("CompleteRegistration", { content_name: "spotkanie" });
      setResult(data.queued ? { ok: true, status: "Zapisany", first_name: nameOut, pending: true,
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
        <p className="rounded-[var(--exm-r-card)] border border-exm-gold-line bg-exm-surface p-6 leading-relaxed text-exm-muted">
          Ten adres jest już zapisany — link do spotkania otrzymasz w wiadomości e-mail.
        </p>
      );
    }
    if (result.status === "Lista rezerwowa") {
      return (
        <p className="rounded-[var(--exm-r-card)] border border-exm-bordo bg-exm-surface p-6 leading-relaxed text-exm-muted">
          Wszystkie miejsca są zajęte. Zapisałem Cię na listę rezerwową — dam znać, jeśli ktoś zrezygnuje.
        </p>
      );
    }
    // Tekst po zapisie (wersja Dawida): bez form „zapisany/a”, link dołączenia w przycisku, bez dzielenia wyrazów.
    const items = String(ev.what_registered || "").split(/\s*[;\n]\s*/).map((x) => x.trim()).filter(Boolean);
    const joinT = (String(result.join_url || "").match(/[?&]t=([0-9a-f]+)/i) || [])[1] || null;
    return (
      <div className="rounded-[var(--exm-r-card)] border border-exm-gold-line bg-exm-bg p-6 sm:p-8 no-hyph">
        <p className="exm-h3">
          {t("dz.spotkanie", { imie: result.first_name || nameOut })}
        </p>
        <p className="text-foreground/70 mt-4 leading-relaxed">
          Uczestnictwo w spotkaniu może stać się jednym z pierwszych kroków Twojego POWROTU.
        </p>
        {items.length > 0 && (
          <>
            <p className="text-foreground/70 mt-4 leading-relaxed">W ramach uczestnictwa otrzymujesz:</p>
            <ul className="mt-2 space-y-1.5 text-foreground/70 leading-relaxed list-disc pl-5 marker:text-[#C9A24A]">
              {items.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </>
        )}
        {result.join_url ? (
          <>
            <p className="text-foreground/70 mt-5 leading-relaxed">Poniżej znajduje się Twój unikalny link dostępowy:</p>
            <a href={result.join_url} className="btn-relic !px-6 !py-3 mt-3">Dołącz do spotkania</a>
            <p className="text-foreground/60 text-sm mt-4 leading-relaxed">
              Zachęcam do zapisania linku lub dodania wydarzenia do kalendarza. Ponieważ jest to link spersonalizowany, proszę o nieudostępnianie go osobom trzecim.
              {Number(ev.price) > 0 ? null : " Do spotkania możesz dołączyć również bezpośrednio przez stronę wydarzenia, podając adres e-mail użyty podczas rejestracji."}
            </p>
          </>
        ) : ev.format !== "Online" ? null : (
          <p className="text-foreground/60 mt-4 leading-relaxed">Link do spotkania otrzymasz na podany adres e-mail.</p>
        )}
        {ev.start_datetime && (
          <CalendarButtons event={ev} joinUrl={result.join_url || null} t={joinT} className="mt-6" />
        )}
        {result.checkout_url && (
          <p className="technical mt-5 text-[10px] text-exm-gold">Za chwilę prowadzę Cię do płatności…</p>
        )}
        <p className="mt-6 text-[13px] leading-relaxed text-exm-muted">
          Gdy zechcesz kolejnego kroku:{" "}
          <Link to="/#listy-powrotu" className="text-exm-gold underline underline-offset-4">Listy powrotu</Link>{" "}
          albo{" "}
          <Link to="/skarbiec/wracam-inny" className="text-exm-gold underline underline-offset-4">Wracam inny</Link>.
        </p>
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
      <div className="rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-6 text-center sm:p-8">
        <p className="exm-h3">Zapisy zamknięte.</p>
        {ev.external_url && (
          <a href={ev.external_url} target="_blank" rel="noreferrer" className="btn-relic mt-6">
            Dołącz do transmisji
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {fromAccount && <AccountContactLine email={acc.email} lead="Zapis na adres:" onChange={() => { setManual(true); setFirstName((v) => v || acc.firstName); setEmail((v) => v || acc.email); }} />}
      {(!fromAccount || !acc.firstName) && (
      <div className={`grid gap-5 ${fromAccount ? "" : "sm:grid-cols-2"}`}>
        <label htmlFor="reg-name" className="block">
          <span className="mb-2 block technical text-[10px] text-exm-muted">IMIĘ</span>
          <input
            id="reg-name"
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Imię"
            className="min-h-[48px] w-full rounded-exm-field border border-exm-line bg-exm-bg px-4 py-3 text-[16px] text-exm-text placeholder:text-exm-muted focus:border-exm-gold focus:outline-none"
          />
        </label>
        {!fromAccount && <label htmlFor="reg-email" className="block">
          <span className="mb-2 block technical text-[10px] text-exm-muted">E-MAIL</span>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="min-h-[48px] w-full rounded-exm-field border border-exm-line bg-exm-bg px-4 py-3 text-[16px] text-exm-text placeholder:text-exm-muted focus:border-exm-gold focus:outline-none"
          />
        </label>}
      </div>
      )}
      {!fromAccount && (
        <ConfirmEmailField id="reg-email2" email={email} value={email2} onChange={setEmail2} label="POWTÓRZ E-MAIL"
          labelClassName="mb-2 block technical text-[10px] text-exm-muted"
          className="min-h-[48px] w-full rounded-exm-field border border-exm-line bg-exm-bg px-4 py-3 text-[16px] text-exm-text placeholder:text-exm-muted focus:border-exm-gold focus:outline-none" />
      )}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="reg-web">Strona www</label>
        <input id="reg-web" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <label htmlFor="reg-q" className="-mb-3 block technical text-[10px] text-exm-muted">PYTANIE (NIEOBOWIĄZKOWO)</label>
      <textarea
        id="reg-q"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Czy jest pytanie, które chcesz mi zadać? (opcjonalnie)"
        className="min-h-[96px] w-full resize-none rounded-exm-field border border-exm-line bg-exm-bg px-4 py-3 text-[16px] text-exm-text placeholder:text-exm-muted focus:border-exm-gold focus:outline-none"
      />
      <label className="flex items-start gap-3 cursor-pointer group py-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setConsentErr(false); }}
          aria-required="true"
          aria-invalid={consentErr}
          aria-describedby={consentErr ? "reg-consent-err" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-exm-gold"
        />
        <span className="text-sm leading-relaxed text-exm-text transition-colors group-hover:text-exm-ivory">
          Akceptuję <Link to="/regulamin" className="gold-text underline">Regulamin</Link>.
        </span>
      </label>
      {consentErr && <p id="reg-consent-err" role="alert" className="-mt-3 text-sm text-exm-error">Zaznacz, żeby się zapisać.</p>}
      <label className="flex items-start gap-3 cursor-pointer group py-2 min-h-[44px]">
        <input
          type="checkbox"
          checked={listy}
          onChange={(e) => setListy(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-exm-gold"
        />
        <span className="text-sm leading-relaxed text-exm-text transition-colors group-hover:text-exm-ivory">
          {TXT.newsletter}
        </span>
      </label>
      <p className="text-xs leading-relaxed text-exm-muted">
        Dane służą do zapisu i przypomnień o spotkaniu. Szczegóły: <Link to="/polityka-prywatnosci" className="gold-text underline">Polityka prywatności</Link>.
      </p>
      {!acc.signedIn && <SignInHint />}
      {error && <p role="alert" className="text-sm leading-relaxed text-exm-error">{error}</p>}
      <button type="submit" disabled={sending} aria-busy={sending} className="btn-relic w-full disabled:cursor-wait disabled:opacity-60">
        {sending ? "Zapisuję…" : "Zapisuję się"}
      </button>
    </form>
  );
}