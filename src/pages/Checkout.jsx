import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import DigitalConsent from "@/components/exmortis/shop/DigitalConsent";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { useCart } from "@/components/exmortis/CartContext";
import { base44 } from "@/api/base44Client";
import NewsletterConsent from "@/components/exmortis/shop/NewsletterConsent";
import AccountOption from "@/components/exmortis/shop/AccountOption";
import OrderSummaryInfo from "@/components/exmortis/shop/OrderSummaryInfo";
import InvoiceFields, { validNip } from "@/components/exmortis/shop/InvoiceFields";
import CheckoutSection from "@/components/exmortis/shop/checkout/CheckoutSection";
import CheckoutField, { fieldCls } from "@/components/exmortis/shop/checkout/CheckoutField";
import SummaryCard from "@/components/exmortis/shop/checkout/SummaryCard";
import CheckoutSummaryBar from "@/components/exmortis/shop/checkout/CheckoutSummaryBar";
import CheckoutResult from "@/components/exmortis/shop/checkout/CheckoutResult";
import EmptyCheckout from "@/components/exmortis/shop/checkout/EmptyCheckout";
import { track, trackPurchase } from "@/lib/track";
import { TXT } from "@/content/legal/seller";
import { suggestEmail } from "@/lib/emailTypo";
import ConfirmEmailField, { sameEmail } from "@/components/common/ConfirmEmailField";

const ORDER_KEY = "exm_payu_order";
const ORDER_VALUE_KEY = "exm_payu_value";
const ORDER_LINK_KEY = "exm_payu_link"; // osobisty link do materiałów (strona po zapłacie)
const ORDER_EMAIL_KEY = "exm_payu_email"; // adres z zamówienia — pokazany na stronie po zapłacie

// Podblok opcjonalny (poza komponentem — inaczej pola traciłyby fokus przy każdym znaku).
function OptionalBlock({ title, children }) {
  return (
    <div className="rounded-[var(--exm-r-field)] border border-exm-line p-4">
      <p className="mb-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[13px] font-medium text-exm-text">{title}</span>
        <span className="text-[11px] text-exm-muted">opcjonalnie</span>
      </p>
      {children}
    </div>
  );
}

export default function Checkout() {
  const { items, total, clear, refresh } = useCart();
  const [cartNote, setCartNote] = useState("");
  const navigate = useNavigate();
  const [payuDone] = useState(() => new URLSearchParams(window.location.search).get("payu") === "done");
  // PayU dopisuje ?error=… do adresu powrotu, gdy płatność przerwano lub odrzucono.
  const [payuError] = useState(() => !!new URLSearchParams(window.location.search).get("error"));
  const [payState, setPayState] = useState("check"); // check | ok | wait | fail
  const [pollNonce, setPollNonce] = useState(0); // ponowne sprawdzenie stanu na żądanie klienta
  const [doneLink, setDoneLink] = useState("");
  const [doneEmail, setDoneEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [digitalConsent, setDigitalConsent] = useState(false);
  const [serviceConsent, setServiceConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [payError, setPayError] = useState("");
  const [discount, setDiscount] = useState(null);
  const [invoice, setInvoice] = useState({ want: false, company: "", nip: "", address: "", post_code: "", city: "" });
  const [showNote, setShowNote] = useState(false);
  const emailTip = suggestEmail(form.email);
  // Drugi raz wpisany adres (25.11.2026): wymagany, gdy adres nie pochodzi z konta zalogowanej osoby.
  const [email2, setEmail2] = useState("");
  const needConfirm = !(user && sameEmail(user.email, form.email));
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
    // Bez numeru zamówienia (np. Safari prywatny z zablokowanym magazynem sesji) nie wiemy,
    // czy płatność przeszła — widok „w weryfikacji" zamiast sukcesu (audyt W3); potwierdzenie mailem.
    if (!orderId) { setPayState("wait"); return undefined; }
    let stop = false, tries = 0;
    const tick = async () => {
      if (stop) return;
      tries++;
      const st = await base44.functions.invoke("payuCreateOrder", { action: "status", orderId })
        .then((r) => r.data?.status).catch(() => null);
      if (stop) return;
      if (st === "COMPLETED") {
        try { localStorage.removeItem("exm_prog_token"); } catch { /* */ }
        let value = 0;
        try { value = Number(sessionStorage.getItem(ORDER_VALUE_KEY)) || 0; sessionStorage.removeItem(ORDER_VALUE_KEY); } catch { /* */ }
        trackPurchase(orderId, value);
        clear();
        try { sessionStorage.removeItem(ORDER_KEY); } catch { /* */ }
        try { setDoneLink(sessionStorage.getItem(ORDER_LINK_KEY) || ""); } catch { /* */ }
        try { setDoneEmail(sessionStorage.getItem(ORDER_EMAIL_KEY) || ""); } catch { /* */ }
        setPayState("ok");
        return;
      }
      if (st === "CANCELED") { setPayState("fail"); return; }
      // PENDING, WAITING_FOR_CONFIRMATION, brak odpowiedzi: płatność NIE jest potwierdzona.
      // Po wyczerpaniu prób zostawiamy zamówienie do dalszej weryfikacji, a koszyka nie ruszamy —
      // adres z ?payu=done nie jest dowodem otrzymania pieniędzy.
      if (tries >= 20) { setPayState("wait"); return; }
      setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [payuDone, payuError, clear, pollNonce]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (invoice.want && !validNip(invoice.nip)) { setPayError("Sprawdź NIP do faktury — powinien mieć 10 cyfr."); return; }
    if (needConfirm && !sameEmail(form.email, email2)) {
      setPayError("Adres e-mail i powtórzony adres się różnią. Popraw je — na ten adres wyślę dostęp do materiałów.");
      document.getElementById("co-email2")?.focus();
      return;
    }
    setPayError("");
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("payuCreateOrder", {
        name: form.name,
        email: form.email,
        note: form.note,
        newsletter_consent: newsletterConsent,
        create_account: !user && createAccount,
        digital_consent: digitalConsent,
        service_consent: serviceConsent,
        terms_consent: termsConsent,
        items: items.map((it) => (it.kind === "bilet" ? { id: it.id, kind: "bilet", holders: it.holders }
          : it.gift ? { id: it.id, qty: it.qty, amount: it.gift.amount, to_name: it.gift.to_name, message: it.gift.message } : { id: it.id, qty: it.qty })),
        code: discount?.code || "",
        invoice: invoice.want ? { want: true, company: invoice.company, nip: invoice.nip, address: invoice.address, post_code: invoice.post_code, city: invoice.city } : null,
        // Rozmowa na progu: osobisty link ze zgłoszenia (serwer sprawdza go tylko dla tej usługi).
        prog_token: (() => { try { return localStorage.getItem("exm_prog_token") || ""; } catch { return ""; } })(),
      });
      // Koszyk czyszczę dopiero po potwierdzeniu płatności — przerwana płatność go nie traci.
      try {
        sessionStorage.setItem(ORDER_KEY, res.data.orderId || "");
        if (res.data.link) sessionStorage.setItem(ORDER_LINK_KEY, res.data.link); else sessionStorage.removeItem(ORDER_LINK_KEY);
        sessionStorage.setItem(ORDER_EMAIL_KEY, String(form.email || "").trim());
        sessionStorage.setItem(ORDER_VALUE_KEY, String(Math.round((Number(discount ? total - discount.discount : total) || 0) * 100) / 100));
      } catch { /* bez pamięci karty */ }
      window.location.href = res.data.redirectUri;
    } catch (err) {
      const msg = err?.response?.data?.error || "";
      if (msg === "PAYU_NOT_CONFIGURED") {
        // Płatności nieaktywne — zamówienie NIE powstało, więc nie udajemy, że przyjęte.
        setPayError("Płatności online jeszcze nie działają. Nic nie zostało pobrane, koszyk zostaje. Napisz do mnie przez formularz kontaktowy — prześlę Ci link do płatności.");
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
    return (
      <CheckoutResult
        payState={payState}
        canceled={payuError}
        doneLink={doneLink}
        doneEmail={doneEmail}
        user={user}
        onRecheck={() => { setPayState("check"); setPollNonce((n) => n + 1); }}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyCheckout />;
  }

  const sum = discount ? (total - discount.discount).toFixed(2) : total;
  const sumPl = String(sum).replace(".", ",");
  // Błąd NIP pokazujemy też w podsumowaniu błędów nad przyciskiem (pole ma własny komunikat).
  const nipError = invoice.want && invoice.nip && !validNip(invoice.nip)
    ? "Sprawdź NIP do faktury — powinien mieć 10 cyfr."
    : "";

  return (
    <div className="bg-exm-bg pt-20">
      <div className="mx-auto w-full max-w-[var(--exm-container)] px-[var(--exm-pad)] py-[var(--exm-section-y)]">
        <header className="max-w-[46ch]">
          <p className="exm-eyebrow">Kasa</p>
          <h1 className="exm-h1 mt-3">Przejdź przez próg</h1>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
          {/* Podsumowanie — komputer: przyklejone po prawej */}
          <aside
            className="hidden lg:sticky lg:top-28 lg:order-2 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1"
            aria-label="Podsumowanie zamówienia"
          >
            <SummaryCard
              items={items}
              total={total}
              sum={sum}
              sumPl={sumPl}
              discount={discount}
              onDiscount={setDiscount}
              email={form.email}
            />
          </aside>

          {/* Formularz — komputer: lewa kolumna, telefon: pod zwiniętym podsumowaniem */}
          <div className="min-w-0 lg:order-1">
            <CheckoutSummaryBar
              items={items}
              total={total}
              sum={sum}
              sumPl={sumPl}
              discount={discount}
              onDiscount={setDiscount}
              email={form.email}
            />

            <form onSubmit={submit} className="mt-6 space-y-8">
              <CheckoutSection title="Twoje dane">
                <div className="space-y-5">
                  <CheckoutField id="co-name" label="Imię i nazwisko">
                    <input
                      id="co-name"
                      autoComplete="name"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={fieldCls}
                    />
                  </CheckoutField>
                  <div>
                    <label htmlFor="co-email" className="mb-2 block text-[13px] font-medium text-exm-text">E-mail</label>
                    <input
                      id="co-email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={fieldCls}
                      aria-describedby="co-email-hint"
                    />
                    {emailTip ? (
                      <p id="co-email-hint" className="mt-2 text-[13px] text-[#E8C547]" role="status">
                        Czy chodziło Ci o{" "}
                        <button type="button" onClick={() => setForm({ ...form, email: emailTip })} className="font-medium underline underline-offset-4 break-all">{emailTip}</button>?
                      </p>
                    ) : (
                      <p id="co-email-hint" className="mt-2 text-[12px] leading-relaxed text-exm-muted">Na ten adres wyślę potwierdzenie i link do materiałów.</p>
                    )}
                  </div>
                  {needConfirm && (
                    <ConfirmEmailField id="co-email2" email={form.email} value={email2} onChange={setEmail2} className={fieldCls} />
                  )}
                </div>
              </CheckoutSection>

              <CheckoutSection title="Opcjonalnie" description="Te dane nie są potrzebne do złożenia zamówienia.">
                <div className="space-y-4">
                  <OptionalBlock title="Faktura">
                    <InvoiceFields value={invoice} onChange={setInvoice} />
                  </OptionalBlock>
                  {!user && (
                    <OptionalBlock title="Konto">
                      <AccountOption items={items} checked={createAccount} onChange={setCreateAccount} />
                    </OptionalBlock>
                  )}
                  <OptionalBlock title="Listy powrotu">
                    <NewsletterConsent checked={newsletterConsent} onChange={setNewsletterConsent} />
                  </OptionalBlock>
                  <OptionalBlock title="Notatka">
                    {showNote || form.note ? (
                      <div>
                        <label htmlFor="co-note" className="sr-only">Notatka do zamówienia</label>
                        <textarea
                          id="co-note"
                          rows={3}
                          value={form.note}
                          onChange={(e) => setForm({ ...form, note: e.target.value })}
                          className={`${fieldCls} resize-none`}
                        />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setShowNote(true)} className="btn-link">Dodaj notatkę do zamówienia</button>
                    )}
                  </OptionalBlock>
                </div>
              </CheckoutSection>

              <CheckoutSection title="Oświadczenia wymagane do zamówienia">
                <div className="space-y-5">
                  <div className="lg:hidden">
                    <OrderSummaryInfo
                      items={items}
                      total={sum}
                      tone="dark"
                      className="rounded-[var(--exm-r-field)] border border-exm-line p-5"
                    />
                  </div>
                  <div className="space-y-4 rounded-[var(--exm-r-field)] border border-exm-line p-5">
                    <label className="flex cursor-pointer gap-3 text-[14px] leading-relaxed text-exm-text">
                      <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} />
                      <span>Akceptuję <Link to="/regulamin" target="_blank" rel="noopener" className="underline">Regulamin</Link>.</span>
                    </label>
                    <DigitalConsent items={items} checked={digitalConsent} onChange={setDigitalConsent} />
                    {items.some((i) => i.product_type === "usluga") && (
                      <label className="flex cursor-pointer gap-3 text-[14px] leading-relaxed text-exm-text">
                        <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={serviceConsent} onChange={(e) => setServiceConsent(e.target.checked)} />
                        <span>{TXT.service}</span>
                      </label>
                    )}
                    <p className="text-[12px] leading-relaxed text-exm-muted">Dane przetwarzam do realizacji zamówienia: <Link to="/polityka-prywatnosci" target="_blank" rel="noopener" className="underline">Polityka prywatności</Link>.</p>
                  </div>
                </div>
              </CheckoutSection>

              <div className="space-y-4 border-t border-exm-line pt-6">
                {cartNote && <p className="text-[13px] leading-relaxed text-exm-muted" role="status">{cartNote}</p>}

                {(payError || nipError) && (
                  <div role="alert" className="space-y-2 rounded-[var(--exm-r-field)] border border-[#E8C547]/40 px-4 py-3 text-[13px] leading-relaxed text-[#E8C547]">
                    {payError && <p>{payError}</p>}
                    {nipError && <p>{nipError}</p>}
                    {payError.includes("/rozmowa-na-progu/zgloszenie") && (
                      <Link to="/rozmowa-na-progu/zgloszenie" className="inline-block font-medium underline underline-offset-4">Przejdź do zgłoszenia</Link>
                    )}
                  </div>
                )}

                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[13px] text-exm-muted">Do zapłaty</span>
                  <span className="font-exm-serif text-3xl text-exm-gold">{sumPl} zł</span>
                </div>

                {form.email.trim() && (
                  <p className="text-[13px] leading-relaxed text-exm-muted">
                    Potwierdzenie i materiały wyślę na adres: <span className="break-all text-exm-text">{form.email.trim()}</span>{" "}
                    · <a href="#co-email" onClick={(e) => { e.preventDefault(); const el = document.getElementById("co-email"); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); }} className="underline underline-offset-4 hover:text-exm-gold">zmień</a>
                  </p>
                )}

                <button type="submit" disabled={submitting} aria-busy={submitting || undefined} className="btn-relic min-h-[56px] w-full text-[16px]">
                  {submitting ? "Przekierowuję do płatności…" : "Zamawiam z obowiązkiem zapłaty"}
                </button>
                <p className="flex items-center justify-center gap-2 text-center text-[12px] leading-relaxed text-exm-muted">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Bezpieczna płatność online przez PayU · potwierdzenie otrzymasz w wiadomości e-mail
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}