import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import NewsletterConsent from "./NewsletterConsent";
import useSystemText from "@/content/useSystemText";

const inputCls =
  "w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";
const labelCls = "technical text-[10px] text-foreground/50 block mb-3";

// Formularz zamówienia bezpłatnego materiału: imię, e-mail, telefon (opcjonalnie)
// z osobną zgodą na kontakt oraz opcjonalna zgoda na newsletter.
// Plik nie jest dostępny na stronie — przychodzi mailem z linkiem do pobrania.
export default function FreeOrderForm({ product }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    phoneConsent: false,
    newsletterConsent: false,
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState("");
  const t = useSystemText();
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      await base44.functions.invoke("orderFree", {
        slug: product.slug,
        name: form.name,
        email: form.email,
        phone: form.phone,
        phone_consent: form.phoneConsent,
        newsletter_consent: form.newsletterConsent,
      });
      setDone(form.name.trim().split(" ")[0] || "przyjacielu");
    } catch {
      setError("Nie udało się zapisać zamówienia. Spróbuj ponownie za chwilę.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="border border-[#C9A24A]/40 bg-[#0D0D0E] p-8 md:p-10 text-center space-y-5 fade-up">
        <Check className="h-8 w-8 gold-text mx-auto" />
        <p className="text-foreground/80 text-lg leading-relaxed">
          {t("dz.pdf", { imie: done })}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 border hairline bg-[#0D0D0E] p-7 md:p-8">
      <p className="technical text-[10px] gold-text">DARMOWY MATERIAŁ · ZERO ZŁ</p>
      <div>
        <label className={labelCls}>IMIĘ *</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>E-MAIL *</label>
        <input
          required
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className={inputCls}
        />
        <div className="mt-3">
          <NewsletterConsent
            checked={form.newsletterConsent}
            onChange={(v) => setForm({ ...form, newsletterConsent: v })}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>TELEFON (NIEOBOWIĄZKOWO)</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className={inputCls}
        />
        <p className="text-xs text-foreground/40 mt-2">
          Jeśli chcesz, żebym mógł do Ciebie zadzwonić.
        </p>
        {form.phone.trim() !== "" && (
          <label className="flex items-start gap-3 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={form.phoneConsent}
              onChange={(e) => setForm({ ...form, phoneConsent: e.target.checked })}
              className="accent-[#C9A24A] w-4 h-4 mt-0.5"
            />
            <span className="text-xs text-foreground/50 leading-relaxed">
              Zgadzam się na kontakt telefoniczny w sprawie moich materiałów i programu POWRÓT.
            </span>
          </label>
        )}
      </div>
      {error && <p className="text-xs blood-text">{error}</p>}
      <button type="submit" disabled={sending} className="btn-relic w-full disabled:opacity-60">
        {sending ? "PRZYGOTOWUJĘ..." : "POBIERZ PLIK"} {!sending && <ArrowRight className="h-4 w-4" />}
      </button>
      <p className="technical text-[10px] text-foreground/40">
        Plik wyślę na Twój e-mail. Bez spamu, bez presji.
      </p>
    </form>
  );
}