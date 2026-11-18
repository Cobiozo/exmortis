import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import useLoginText from "@/content/useLoginText";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const t = useLoginText();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {
      // Always show success regardless
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      title={t("reset.tytul")}
      subtitle={t("reset.podtytul")}
      footer={<Link to="/login" className="btn-link">{t("reset.powrot")}</Link>}
    >
      {sent ? (
        <p role="status" className="rounded-[var(--exm-r-field)] border border-exm-line bg-exm-surface-2 px-4 py-3 text-[13px] leading-relaxed text-exm-text">
          {t("reset.wyslano")}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AuthField
            id="email" label="Adres e-mail" type="email" autoComplete="email" autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <button type="submit" disabled={loading} aria-busy={loading || undefined} className="btn-relic w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("reset.przycisk")}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}