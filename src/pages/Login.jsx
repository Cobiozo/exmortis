import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import GoogleButton from "@/components/auth/GoogleButton";
import { afterLoginTarget, providerReturnTo } from "@/lib/afterLogin";
import useLoginText from "@/content/useLoginText";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = useLoginText();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      localStorage.setItem("exm_login_via", "haslo");
      window.location.href = await afterLoginTarget();
    } catch (err) {
      setError(t("blad"));
      setLoading(false);
    }
  };

  return (
    <AuthLayout tabs>
      <GoogleButton onClick={() => { localStorage.setItem("exm_login_via", "google"); base44.auth.loginWithProvider("google", providerReturnTo()); }} />
      {error && <p className="mb-5 text-sm text-[#E8C547]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField id="email" label={t("pole.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <AuthField
          id="password" label={t("pole.haslo")} type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required
          aside={<Link to="/forgot-password" className="text-xs text-foreground/45 hover:text-[#C9A24A]">{t("nie_pamietam")}</Link>}
        />
        <button type="submit" disabled={loading} className="btn-relic w-full disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("przycisk")}
        </button>
      </form>
    </AuthLayout>
  );
}