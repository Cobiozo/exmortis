import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import NewsletterConsent from "./NewsletterConsent";
import useSystemText from "@/content/useSystemText";
import { track } from "@/lib/track";
import { FUNNEL } from "@/lib/funnelEvents";
import { useAccountContact, AccountContactLine, SignInHint } from "@/components/common/AccountContact";

const inputCls =
  "w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";
const labelCls = "technical text-[10px] text-foreground/55 block mb-3";

// Formularz zamówienia bezpłatnego materiału: imię, e-mail i opcjonalna zgoda na newsletter.
// Telefonu nie zbieramy. Plik nie jest dostępny na stronie — przychodzi mailem z linkiem do pobrania.
export default function FreeOrderForm({ product }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    newsletterConsent: false,
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState("");
  const t = useSystemText();
  const [error, setError] = useState("");
  // Zalogowana osoba: imię i e-mail z konta (bez wpisywania); „zmień” pokazuje pola.
  const acc = useAccountContact();
  const [manual, setManual] = useState(false);
  const fromAccount = acc.signedIn && !manual;
  const name = fromAccount && acc.name ? acc.name : form.name;
  const email = fromAccount ? acc.email : form.email;

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("orderFree", {
        slug: product.slug,
        name,
        email,
        phone: "",
        newsletter_consent: form.newsletterConsent,
      });
      track(FUNNEL.freePdf, { slug: product.slug });
      setDone({ imie: name.trim().split(" ")[0] || "", delivery: res?.data?.delivery || "wyslany" });
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się zapisać zamówienia. Spróbuj ponownie za chwilę.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="border border-[#C9A24A]/40 bg-[#0D0D0E] p-8 md:p-10 text-center space-y-5 fade-up">
        <Check className="h-8 w-8 gold-text mx-auto" />
        <p className="text-foreground/80 text-lg leading-relaxed">
          {done.delivery === "kolejka"
            ? `Zapisałem Twoje zamówienie${done.imie ? `, ${done.imie}` : ""}. Mail z materiałem wyjdzie w ciągu najbliższych godzin — sprawdź też folder Spam lub Oferty.`
            : done.delivery === "recznie"
              ? `Zapisałem Twoje zamówienie${done.imie ? `, ${done.imie}` : ""}. Twoją osobistą kopię materiału wyślę w osobnej wiadomości.`
              : t("dz.pdf", { imie: done.imie })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 border hairline bg-[#0D0D0E] p-7 md:p-8">
      <p className="technical text-[10px] gold-text">DARMOWY MATERIAŁ · ZERO ZŁ</p>
      {fromAccount && <AccountContactLine email={acc.email} onChange={() => { setManual(true); setForm((f) => ({ ...f, name: f.name || acc.name, email: f.email || acc.email })); }} />}
      {(!fromAccount || !acc.name) && (
        <div>
          <label htmlFor="free-name" className={labelCls}>IMIĘ *</label>
          <input
            id="free-name"
            required
            autoComplete="given-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </div>
      )}
      <div>
        {!fromAccount && (
          <>
            <label htmlFor="free-email" className={labelCls}>E-MAIL *</label>
            <input
              id="free-email"
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </>
        )}
        <div className="mt-3">
          <NewsletterConsent
            checked={form.newsletterConsent}
            onChange={(v) => setForm({ ...form, newsletterConsent: v })}
          />
        </div>
      </div>
      {error && <p className="text-xs blood-text">{error}</p>}
      <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
        {sending ? "WYSYŁAM..." : "WYŚLIJ NA MÓJ E-MAIL"} {!sending && <ArrowRight className="h-4 w-4" />}
      </button>
      {!acc.signedIn && <SignInHint />}
      <p className="technical text-[10px] text-foreground/55">
        PDF przychodzi mailem — nie ma go do pobrania na stronie. Bez spamu, bez presji.
      </p>
    </form>
  );
}