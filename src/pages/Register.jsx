import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import AuthSwitch from "@/components/auth/AuthSwitch";
import AuthField from "@/components/auth/AuthField";
import GoogleButton from "@/components/auth/GoogleButton";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { afterLoginTarget, providerReturnTo } from "@/lib/afterLogin";
import useLoginText from "@/content/useLoginText";
import { track } from "@/lib/track";
import { TXT } from "@/content/legal/seller";

const check = "mt-0.5 h-5 w-5 shrink-0 accent-exm-gold";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [letters, setLetters] = useState(false);
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const { search } = useLocation();
  // Link z maila exmortis: /register?potwierdz=<token_hash>
  const confirmHash = new URLSearchParams(search).get("potwierdz") || "";
  const [confirming, setConfirming] = useState(!!confirmHash);
  const [confirmError, setConfirmError] = useState("");
  const t = useLoginText();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setPwError("");
    if (password.length < 10) return setPwError("Hasło musi mieć co najmniej 10 znaków.");
    if (!terms) return setError("Zaakceptuj regulamin i politykę prywatności.");
    setLoading(true);
    try {
      await base44.auth.register({ email, password, name: name.trim(), letters });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Nie udało się założyć konta.");
    } finally {
      setLoading(false);
    }
  };

  // Dokończenie rejestracji po potwierdzeniu adresu: imię, akceptacja regulaminu, zapis na Listy (gdy zaznaczony),
  // kod powitalny i mail z podziękowaniem od razu, potem przejście dalej.
  const finish = async (pending) => {
    await base44.auth.updateMe({ imie: pending.name, terms_accepted_at: pending.terms_at || new Date().toISOString() }).catch(() => {});
    if (pending.letters) {
      await base44.functions.invoke("subscribeNewsletter", { email: pending.email, name: pending.name })
        .then(() => track("Lead", { content_name: "newsletter" })).catch(() => {});
    }
    if (base44.auth.welcome) await base44.auth.welcome();
    window.location.href = await afterLoginTarget();
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (confirmHash) {
          // Link z maila exmortis → sesja, potem dane z konta (działa też na innym urządzeniu).
          const { meta, email: mail } = await base44.auth.confirmSignup(confirmHash);
          let pending = null;
          try { pending = JSON.parse(sessionStorage.getItem("exm_pending_reg") || "null"); sessionStorage.removeItem("exm_pending_reg"); } catch { /* brak pamięci */ }
          if (!alive) return;
          await finish({
            email: mail || pending?.email || "",
            name: meta.imie || meta.full_name || pending?.name || "",
            letters: meta.letters === true || !!pending?.letters,
            terms_at: meta.terms_accepted_at,
          });
          return;
        }
        // Dawny link Supabase wracał tutaj z sesją w adresie.
        if (!(await base44.auth.isAuthenticated())) return;
        const pending = JSON.parse(sessionStorage.getItem("exm_pending_reg") || "null");
        if (!pending) return;
        sessionStorage.removeItem("exm_pending_reg");
        if (!alive) return;
        await finish(pending);
      } catch {
        if (alive && confirmHash) {
          setConfirming(false);
          setConfirmError("Ten link wygasł albo został już użyty. Jeśli konto jest już potwierdzone — zaloguj się. Jeśli nie, załóż je jeszcze raz tym samym adresem, a wyślę nowy link.");
        }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      setInfo("Wysłałem nowy link. Sprawdź skrzynkę (także folder spam).");
    } catch (err) {
      setError(err.message || "Nie udało się wysłać kodu.");
    }
  };

  if (confirming || confirmError) {
    return (
      <AuthLayout
        title={confirmError ? "Nie udało się potwierdzić adresu" : "Potwierdzam adres e-mail"}
        subtitle={confirmError ? "" : "Chwilę — kończę zakładanie konta."}
        footer={<Link to="/login" className="btn-link">Przejdź do logowania</Link>}
      >
        {confirmError ? (
          <p role="alert" className="rounded-[var(--exm-r-field)] border border-exm-error px-4 py-3 text-[14px] leading-relaxed text-exm-text">
            {confirmError}
          </p>
        ) : (
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-exm-gold" aria-hidden="true" />
            <span className="sr-only">Potwierdzam adres e-mail</span>
          </div>
        )}
      </AuthLayout>
    );
  }

  if (showOtp) {
    return (
      <AuthLayout
        title="Potwierdź adres e-mail"
        subtitle={`Wysłałem link potwierdzenia na ${email}.`}
        footer={<Link to={`/login${search}`} className="btn-link">Wróć do logowania</Link>}
      >
        <p className="mb-5 text-[15px] leading-relaxed text-exm-muted">
          Otwórz wiadomość i kliknij zawarty w niej link — rejestracja zakończy się automatycznie, a strona na chwilę wróci w to miejsce.
        </p>
        {error && (
          <p role="alert" className="mb-5 rounded-[var(--exm-r-field)] border border-exm-error px-4 py-3 text-[13px] leading-relaxed text-exm-error">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="mb-5 rounded-[var(--exm-r-field)] border border-exm-line bg-exm-surface-2 px-4 py-3 text-[13px] leading-relaxed text-exm-text">
            {info}
          </p>
        )}
        <button onClick={handleResend} disabled={loading} aria-busy={loading || undefined} className="btn-ghost w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Wyślij ponownie
        </button>
        <p className="mt-5 text-center text-[13px] text-exm-muted">Nie widzisz wiadomości? Sprawdź folder spam.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Załóż konto"
      subtitle="Potrzebujemy imienia, adresu e-mail i hasła."
    >
      <GoogleButton onClick={() => base44.auth.loginWithProvider("google", providerReturnTo())} />
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField id="name" label="Imię" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <AuthField id="email" label="Adres e-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <AuthField
          id="password" label="Hasło" type="password" autoComplete="new-password" error={pwError}
          value={password} onChange={(e) => { setPassword(e.target.value); setPwError(""); }} required
        />
        <PasswordStrength value={password} />
        <label className="flex gap-3 text-[13px] leading-relaxed text-exm-muted">
          <input type="checkbox" className={check} checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
          <span>Akceptuję <Link to="/regulamin" className="text-exm-gold underline">Regulamin</Link>. Zasady przetwarzania danych: <Link to="/polityka-prywatnosci" className="text-exm-gold underline">Polityka prywatności</Link>.</span>
        </label>
        <label className="flex gap-3 text-[13px] leading-relaxed text-exm-muted">
          <input type="checkbox" className={check} checked={letters} onChange={(e) => setLetters(e.target.checked)} />
          <span>{TXT.newsletter}</span>
        </label>
        {error && (
          <p role="alert" className="rounded-[var(--exm-r-field)] border border-exm-error px-4 py-3 text-[13px] leading-relaxed text-exm-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} aria-busy={loading || undefined} className="btn-relic w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Załóż konto
        </button>
      </form>
      <AuthSwitch question="Masz już konto?" label={t("zakladka.login")} to={`/login${search}`} />
    </AuthLayout>
  );
}