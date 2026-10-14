import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/auth/AuthField";
import GoogleButton from "@/components/auth/GoogleButton";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { afterLoginTarget, providerReturnTo } from "@/lib/afterLogin";
import { track } from "@/lib/track";

const check = "mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [letters, setLetters] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 10) return setError("Hasło musi mieć co najmniej 10 znaków.");
    if (!terms) return setError("Zaakceptuj regulamin i politykę prywatności.");
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Nie udało się założyć konta.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      await base44.auth.updateMe({ imie: name.trim(), terms_accepted_at: new Date().toISOString() }).catch(() => {});
      if (letters) await base44.functions.invoke("subscribeNewsletter", { email, name }).then(() => track("Lead", { content_name: "newsletter" })).catch(() => {});
      window.location.href = await afterLoginTarget();
    } catch (err) {
      setError(err.message || "Niepoprawny kod.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      setInfo("Wysłałem nowy kod.");
    } catch (err) {
      setError(err.message || "Nie udało się wysłać kodu.");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout title="Potwierdź adres e-mail" subtitle={`Wysłałem kod na ${email}.`}>
        {error && <p className="mb-5 text-sm text-[#E8C547]">{error}</p>}
        {info && <p className="mb-5 text-sm gold-text">{info}</p>}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <button onClick={handleVerify} disabled={loading || otpCode.length < 6} className="btn-relic w-full disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} POTWIERDŹ
        </button>
        <p className="text-center text-sm text-foreground/55 mt-5">
          Nie dotarł? <button onClick={handleResend} className="gold-text hover:underline">Wyślij ponownie</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout tabs>
      <GoogleButton onClick={() => base44.auth.loginWithProvider("google", providerReturnTo())} />
      {error && <p className="mb-5 text-sm text-[#E8C547]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField id="name" label="IMIĘ" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <AuthField id="email" label="E-MAIL" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <AuthField id="password" label="HASŁO" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <PasswordStrength value={password} />
        <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed">
          <input type="checkbox" className={check} checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
          <span>Akceptuję <Link to="/regulamin" className="gold-text underline">regulamin</Link> i <Link to="/polityka-prywatnosci" className="gold-text underline">politykę prywatności</Link>.</span>
        </label>
        <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed">
          <input type="checkbox" className={check} checked={letters} onChange={(e) => setLetters(e.target.checked)} />
          <span>Chcę dostawać Listy powrotu — jeden list w każdy poniedziałek.</span>
        </label>
        <button type="submit" disabled={loading} className="btn-relic w-full disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} ZAŁÓŻ KONTO
        </button>
      </form>
    </AuthLayout>
  );
}