import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import useLoginText from "@/content/useLoginText";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  // Link z Supabase (logowanie poza platformą) przynosi sesję w #hash zamiast ?token=
  const hasSupaSession = typeof window !== "undefined" &&
    new URLSearchParams(window.location.hash.slice(1)).has("access_token");
  const t = useLoginText();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError(t("nowe.niezgodne"));
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken: hasSupaSession ? null : resetToken, newPassword });
      window.location.href = "/login";
    } catch (err) {
      setError(t("nowe.blad"));
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken && !hasSupaSession) {
    return (
      <AuthLayout
        title={t("nowe.tytul")}
        subtitle={t("nowe.zly_link")}
        footer={<Link to="/forgot-password" className="btn-link">Poproś o nowy link</Link>}
      >
        <p className="text-[15px] leading-relaxed text-exm-muted">
          Poproś o nowy link. Wyślemy go na adres e-mail przypisany do konta.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("nowe.tytul")} subtitle={t("nowe.podtytul")}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          id="password" label="Nowe hasło" type="password" autoComplete="new-password" autoFocus
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required
        />
        <AuthField
          id="confirm" label="Powtórz hasło" type="password" autoComplete="new-password"
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
          error={newPassword !== confirmPassword ? t("nowe.niezgodne") : ""}
        />
        {error && error !== t("nowe.niezgodne") && (
          <p role="alert" className="rounded-[var(--exm-r-field)] border border-exm-error px-4 py-3 text-[13px] leading-relaxed text-exm-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} aria-busy={loading || undefined} className="btn-relic w-full">
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Ustaw nowe hasło
        </button>
      </form>
    </AuthLayout>
  );
}