import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import GoogleButton from "@/components/auth/GoogleButton";
import { afterLoginTarget, providerReturnTo, loggedInTarget } from "@/lib/afterLogin";
import useLoginText from "@/content/useLoginText";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Sesja już jest (powrót z Google albo wejście zalogowanego) — bez formularza, od razu dalej.
  const [checking, setChecking] = useState(true);
  const t = useLoginText();

  useEffect(() => {
    let alive = true;
    // Błąd logowania przez Google (/functions/googleAuth) wraca w #error_description — pokazujemy go nad formularzem.
    const h = new URLSearchParams(window.location.hash.slice(1));
    if (h.get("error_description")) {
      setError(h.get("error_description"));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    loggedInTarget()
      .then((to) => { if (!alive) return; if (to) window.location.replace(to); else setChecking(false); })
      .catch(() => alive && setChecking(false));
    return () => { alive = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      localStorage.setItem("exm_login_via", "haslo");
      window.location.replace(await afterLoginTarget());
    } catch (err) {
      setError(t("blad"));
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]" role="status" aria-label="Logowanie">
        <Loader2 className="h-7 w-7 animate-spin text-[#C9A24A]" />
      </div>
    );
  }

  return (
    <AuthLayout tabs>
      <GoogleButton onClick={() => { localStorage.setItem("exm_login_via", "google"); base44.auth.loginWithProvider("google", providerReturnTo()); }} />
      {error && <p className="mb-5 text-sm text-[#E8C547]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField id="email" label={t("pole.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <AuthField
          id="password" label={t("pole.haslo")} type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
          aside={<Link to="/forgot-password" className="inline-block py-2 -my-2 text-xs text-foreground/55 hover:text-[#C9A24A]">{t("nie_pamietam")}</Link>}
        />
        <button type="submit" disabled={loading} className="btn-relic w-full disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("przycisk")}
        </button>
      </form>
    </AuthLayout>
  );
}