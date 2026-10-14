import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import DigitalConsent from "@/components/exmortis/shop/DigitalConsent";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useCart } from "@/components/exmortis/CartContext";
import { base44 } from "@/api/base44Client";
import NewsletterConsent from "@/components/exmortis/shop/NewsletterConsent";
import DiscountField from "@/components/exmortis/shop/DiscountField";
import OrderSummaryInfo from "@/components/exmortis/shop/OrderSummaryInfo";
import ChooseTermButton from "@/components/exmortis/shop/ChooseTermButton";
import InvoiceFields, { validNip } from "@/components/exmortis/shop/InvoiceFields";
import { GiftLine } from "@/components/exmortis/shop/GiftCard";
import { TicketLine } from "@/components/exmortis/events/TicketBuy";
import { track, trackPurchase } from "@/lib/track";

const ORDER_KEY = "exm_payu_order";
const ORDER_VALUE_KEY = "exm_payu_value";

export default function Checkout() {
  const { items, total, clear, refresh } = useCart();
  const [cartNote, setCartNote] = useState("");
  const navigate = useNavigate();
  const [payuDone] = useState(() => new URLSearchParams(window.location.search).get("payu") === "done");
  // PayU dopisuje ?error=… do adresu powrotu, gdy płatność przerwano lub odrzucono.
  const [payuError] = useState(() => !!new URLSearchParams(window.location.search).get("error"));
  const [payState, setPayState] = useState("check"); // check | ok | wait | fail
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [digitalConsent, setDigitalConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [payError, setPayError] = useState("");
  const [discount, setDiscount] = useState(null);
  const [invoice, setInvoice] = useState({ want: false, company: "", nip: "", address: "" });
  const { user } = useAuth();
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.imie || user.full_name || "", email: f.email || user.email }));
  }, [user]);

  // Wejście do kasy z zawartością koszyka — raz na wizytę (powrót z płatności to nie nowy koszyk).
  const checkoutFired = useRef(false);
  useEffect(() => {
    if (checkoutFired.current || payuDone || !items.length) return;
    checkoutFired.current = true;
    track("InitiateCheckout", { value: Math.round((Number(discount ? total - discount.discount : total) || 0) * 100) / 100, currency: "PLN", num_items: items.length });
  }, [items.length]);

  // Przed płatnością: aktualne ceny i dostępność (np. koniec promocji) — kasa liczy tak samo na serwerze.
  useEffect(() => {
    if (payuDone) return;
    let live = true;
    base44.functions.invoke("shopProducts", {})
      .then((r) => { if (live && refresh(r.data?.products || [])) setCartNote("Zaktualizowałem koszyk: ceny lub dostępność zmieniły się od dodania produktu."); })
      .catch(() => {});
    return () => { live = false; };
    // jednorazowo przy wejściu do kasy
  }, []);

  // Powrót z PayU: sprawdzam stan zamówienia (powiadomienie PayU bywa o kilka sekund później niż powrót).
  useEffect(() => {
    if (!payuDone) return undefined;
    if (payuError) { setPayState("fail"); return undefined; }
    let orderId = "";
    try { orderId = sessionStorage.getItem(ORDER_KEY) || ""; } catch { /* brak */ }
    if (!orderId) { clear(); setPayState("ok"); return undefined; }
    let stop = false, tries = 0;
    const tick = async () => {
      if (stop) return;
      tries++;
      const st = await base44.functions.invoke("payuCreateOrder", { action: "status", orderId })
        .then((r) => r.data?.status).catch(() => null);
      if (stop) return;
      if (st === "COMPLETED") {
        let value = 0;
        try { value = Number(sessionStorage.getItem(ORDER_VALUE_KEY)) || 0; sessionStorage.removeItem(ORDER_VALUE_KEY); } catch { /* */ }
        trackPurchase(orderId, value);
        clear();
        try { sessionStorage.removeItem(ORDER_KEY); } catch { /* */ }
        setPayState("ok");
        return;
      }
      if (st === "CANCELED") { setPayState("fail"); return; }
      if (tries >= 20) { clear(); setPayState("wait"); return; }
      setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [payuDone, payuError, clear]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (invoice.want && !validNip(invoice.nip)) { setPayError("Sprawdź NIP do faktury — powinien mieć 10 cyfr."); return; }
    setPayError("");
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("payuCreateOrder", {
        name: form.name,
        email: form.email,
        note: form.note,
        newsletter_consent: newsletterConsent,
        digital_consent: digitalConsent,
        terms_consent: termsConsent,
        items: items.map((it) => (it.kind === "bilet" ? { id: it.id, kind: "bilet", holders: it.holders }
          : it.gift ? { id: it.id, qty: it.qty, amount: it.gift.amount, to_name: it.gift.to_name, message: it.gift.message } : { id: it.id, qty: it.qty })),
        code: discount?.code || "",
        invoice: invoice.want ? { want: true, company: invoice.company, nip: invoice.nip, address: invoice.address } : null,
      });
      // Koszyk czyszczę dopiero po potwierdzeniu płatności — przerwana płatność go nie traci.
      try {
        sessionStorage.setItem(ORDER_KEY, res.data.orderId || "");
        sessionStorage.setItem(ORDER_VALUE_KEY, String(Math.round((Number(discount ? total - discount.discount : total) || 0) * 100) / 100));
      } catch { /* bez pamięci karty */ }
      window.location.href = res.data.redirectUri;
    } catch (err) {
      const msg = err?.response?.data?.error || "";
      if (msg === "PAYU_NOT_CONFIGURED") {
        // Płatności nieaktywne — zamówienie NIE powstało, więc nie udajemy, że przyjęte.
        setPayError("Płatności online jeszcze nie działają. Nic nie zostało pobrane, koszyk zostaje. Napisz do mnie przez formularz kontaktowy, a odezwę się z płatnością.");
      } else if (msg && !/^PayU|Supabase|fetch/i.test(msg)) {
        setPayError(msg);
      } else {
        setPayError("Płatność się nie udała. Nic nie zostało pobrane — spróbuj jeszcze raz.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (payuDone) {
    const fail = payState === "fail";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] pt-20 px-6 text-center gap-8">
        {payState === "check" ? (
          <>
            <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
            <p className="text-foreground/60 text-lg max-w-md leading-relaxed" role="status">Sprawdzam płatność w PayU…</p>
          </>
        ) : fail ? (
          <>
            <h1 className="relic-heading text-4xl md:text-6xl">Płatność nie doszła do skutku</h1>
            <p className="text-foreground/60 text-lg max-w-md leading-relaxed">
              Nic nie zostało pobrane albo PayU zwróci środki. Koszyk na Ciebie czeka.
            </p>
            <a href="/kasa" className="btn-relic">WRÓĆ DO KASY <ArrowRight className="h-4 w-4" /></a>
          </>
        ) : (
          <>
            <div className="w-16 h-16 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 gold-text" />
            </div>
            <h1 className="relic-heading text-4xl md:text-6xl gold-text">Próg przekroczony</h1>
            <p className="text-foreground/60 text-lg max-w-md leading-relaxed">
              {payState === "wait"
                ? "PayU jeszcze potwierdza płatność. Gdy dotrze, dostaniesz maila z dostępem — zwykle w kilka minut."
                : "Płatność dotarła. Dostęp i szczegóły są już w drodze na Twój mail — pierwszy ruch jest już za Tobą."}
            </p>
            <ChooseTermButton />
            <Link to="/konto" className="btn-ghost">MOJE PRODUKTY</Link>
          </>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] pt-20 px-6 text-center gap-8">
        <h1 className="relic-heading text-4xl text-foreground/40">Skarbiec pusty</h1>
        <p className="text-foreground/60">Nie masz jeszcze nic na drodze powrotu.</p>
        <Link to="/skarbiec" className="btn-relic">DO SKLEPU <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0B] pt-20">
      <section className="mx-auto max-w-[1100px] px-5 md:px-10 py-16 md:py-24">
        <p className="technical text-[11px] gold-text mb-6">KASA · FINALNY RUCH</p>
        <h1 className="relic-heading text-4xl md:text-6xl mb-16 leading-[0.95]">
          Przejdź<br /><span className="gold-text">przez próg</span>
        </h1>

        <div className="grid md:grid-cols-5 gap-10">
          {/* Form */}
          <form onSubmit={submit} className="md:col-span-3 space-y-8">
            <div>
              <label htmlFor="co-name" className="technical text-[10px] text-foreground/50 block mb-3">IMIĘ I NAZWISKO</label>
              <input
                id="co-name"
                autoComplete="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="co-email" className="technical text-[10px] text-foreground/50 block mb-3">E-MAIL</label>
              <input
                id="co-email"
                autoComplete="email"
                inputMode="email"
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors"
              />
              <div className="mt-3">
                <NewsletterConsent checked={newsletterConsent} onChange={setNewsletterConsent} />
              </div>
            </div>
            <div>
              <label htmlFor="co-note" className="technical text-[10px] text-foreground/50 block mb-3">NOTATKA (OPCJONALNIE)</label>
              <textarea
                id="co-note"
                rows={4}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors resize-none"
              />
            </div>

            <InvoiceFields value={invoice} onChange={setInvoice} />

            <OrderSummaryInfo items={items} total={discount ? (total - discount.discount).toFixed(2) : total} />
            <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed">
              <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} />
              <span>Akceptuję <Link to="/regulamin" className="underline">Regulamin</Link>. Znam <Link to="/polityka-prywatnosci" className="underline">Politykę prywatności</Link>.</span>
            </label>
            <DigitalConsent items={items} checked={digitalConsent} onChange={setDigitalConsent} />
            {cartNote && <p className="text-sm text-foreground/70" role="status">{cartNote}</p>}
            {payError && <p className="text-sm text-[#E8C547]" role="alert">{payError}</p>}
            <button type="submit" disabled={submitting} className="btn-relic w-full disabled:opacity-60">
              {submitting ? "PRZYGOTOWUJĘ PŁATNOŚĆ..." : "Zamawiam z obowiązkiem zapłaty"}{" "}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
            <p className="technical text-[10px] text-foreground/40">
              Bezpieczna płatność online przez PayU. Potwierdzenie otrzymasz na maila.
            </p>
          </form>

          {/* Summary */}
          <div className="md:col-span-2">
            <div className="border hairline p-6 space-y-4 sticky top-28">
              <p className="technical text-[11px] gold-text pb-4 border-b hairline">TWOJE ZAPISY</p>
              {items.map((item) => (
                <div key={item.key || item.id} className="flex gap-4">
                  <div className="w-14 h-14 bg-card border hairline overflow-hidden flex-shrink-0">
                    {item.image_url && <img src={item.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="relic-heading text-sm gold-text truncate">{item.name}</p>
                    <p className="font-mono text-xs text-foreground/50">{item.qty} × {item.price} zł</p>
                    {item.gift && <GiftLine gift={item.gift} />}
                    {item.kind === "bilet" && <TicketLine holders={item.holders} />}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t hairline">
                <DiscountField items={items} applied={discount} onApply={setDiscount} />
              </div>
              <div className="pt-4 border-t hairline flex justify-between items-center">
                <span className="technical text-[11px] text-foreground/60">RAZEM</span>
                <span className="font-mono text-2xl gold-text">{discount ? (total - discount.discount).toFixed(2) : total} zł</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}