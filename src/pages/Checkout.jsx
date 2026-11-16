import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import DigitalConsent from "@/components/exmortis/shop/DigitalConsent";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Download, Lock } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useCart } from "@/components/exmortis/CartContext";
import { base44 } from "@/api/base44Client";
import NewsletterConsent from "@/components/exmortis/shop/NewsletterConsent";
import AccountOption from "@/components/exmortis/shop/AccountOption";
import DiscountField from "@/components/exmortis/shop/DiscountField";
import OrderSummaryInfo from "@/components/exmortis/shop/OrderSummaryInfo";
import ChooseTermButton from "@/components/exmortis/shop/ChooseTermButton";
import InvoiceFields, { validNip } from "@/components/exmortis/shop/InvoiceFields";
import { GiftLine } from "@/components/exmortis/shop/GiftCard";
import { TicketLine } from "@/components/exmortis/events/TicketBuy";
import { track, trackPurchase } from "@/lib/track";
import { TXT } from "@/content/legal/seller";
import { suggestEmail } from "@/lib/emailTypo";

const ORDER_KEY = "exm_payu_order";
const ORDER_VALUE_KEY = "exm_payu_value";
const ORDER_LINK_KEY = "exm_payu_link"; // osobisty link do materiałów (strona po zapłacie)
const ORDER_EMAIL_KEY = "exm_payu_email"; // adres z zamówienia — pokazany na stronie po zapłacie

// Sekcja formularza kasy (poza komponentem — inaczej pola traciłyby fokus przy każdym znaku).
function Step({ n, title, hint, children }) {
  return (
    <fieldset className="border-t hairline pt-8">
      <legend className="sr-only">{title}</legend>
      <p className="flex items-baseline gap-3 mb-6">
        <span className="font-mono text-xs gold-text">{n}</span>
        <span className="technical text-[11px] text-foreground/80">{title}</span>
        {hint && <span className="text-xs text-foreground/45">{hint}</span>}
      </p>
      {children}
    </fieldset>
  );
}
const inputCls = "w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors";

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
  const [invoice, setInvoice] = useState({ want: false, company: "", nip: "", address: "" });
  const [showNote, setShowNote] = useState(false);
  const emailTip = suggestEmail(form.email);
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
        invoice: invoice.want ? { want: true, company: invoice.company, nip: invoice.nip, address: invoice.address } : null,
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
              Nic nie zostało pobrane albo PayU zwróci środki. Koszyk na Ciebie czeka — możesz spróbować jeszcze raz.
            </p>
            <a href="/kasa" className="btn-relic">WRÓĆ DO KASY <ArrowRight className="h-4 w-4" /></a>
          </>
        ) : payState === "wait" ? (
          <>
            <h1 className="relic-heading text-3xl md:text-5xl">Płatność w weryfikacji</h1>
            <p className="text-foreground/60 text-lg max-w-md leading-relaxed">
              PayU jeszcze nie potwierdziło płatności. Nie traktujemy jej jako opłaconej, dopóki nie dotrze
              powiadomienie z bramki. Koszyk zostaje na swoim miejscu, a dostęp i szczegóły otrzymasz w wiadomości e-mail —
              zwykle w kilka minut.
            </p>
            <button
              type="button"
              onClick={() => { setPayState("check"); setPollNonce((n) => n + 1); }}
              className="btn-ghost"
            >
              SPRAWDŹ PONOWNIE
            </button>
            <Link to="/kontakt" className="technical text-[10px] text-foreground/55 hover:gold-text">NAPISZ, JEŻELI PŁATNOŚĆ NIE DOTARŁA</Link>
          </>
        ) : (
          <>
            <div className="w-16 h-16 border-2 border-[#C9A24A] rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 gold-text" />
            </div>
            <h1 className="relic-heading text-4xl md:text-6xl gold-text">Próg przekroczony</h1>
            <p className="text-foreground/60 text-lg max-w-md leading-relaxed">
              Płatność została przyjęta. Potwierdzenie {doneLink ? "zamówienia i link do materiałów wysłałem" : "zamówienia wysłałem"} na Twój adres e-mail — pierwszy ruch jest już za Tobą.
            </p>
            {doneEmail && (
              <p className="text-sm text-foreground/55 max-w-md leading-relaxed">
                Wiadomość wysłałem na adres <span className="text-foreground/85 break-all">{doneEmail}</span>. Jeśli nie dotrze w ciągu kilku minut, sprawdź folder „Spam” lub{" "}
                <Link to="/kontakt" className="underline underline-offset-4 hover:text-[#C9A24A]">napisz do mnie</Link> — w razie błędu w adresie wyślę materiały ponownie.
              </p>
            )}
            {doneLink && (
              <a href={`/pobierz#t=${doneLink}`} className="btn-relic">POBIERZ MATERIAŁY <Download className="h-4 w-4" /></a>
            )}
            <ChooseTermButton />
            {user ? (
              <Link to="/konto" className="btn-ghost">MOJE PRODUKTY</Link>
            ) : doneLink ? (
              <div className="border hairline p-6 max-w-md text-left">
                <p className="technical text-[10px] gold-text mb-3">BEZPŁATNE KONTO EXMORTIS</p>
                <p className="text-foreground/70 leading-relaxed">Załóż je jednym kliknięciem na ten sam adres — zakup już tam czeka. Dostaniesz też ROZDROŻA, Bibliotekę i 20 zł na kolejny materiał.</p>
                <a href={`/pobierz#t=${doneLink}&a=1`} className="btn-ghost mt-5">AKTYWUJ KONTO <ArrowRight className="h-4 w-4" /></a>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] pt-20 px-6 text-center gap-8">
        <h1 className="relic-heading text-4xl text-foreground/55">Skarbiec pusty</h1>
        <p className="text-foreground/60">Nie masz jeszcze nic na drodze powrotu.</p>
        <Link to="/skarbiec" className="btn-relic">DO SKLEPU <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  const sum = discount ? (total - discount.discount).toFixed(2) : total;
  const sumPl = String(sum).replace(".", ",");

  return (
    <div className="bg-[#0A0A0B] pt-20">
      <section className="mx-auto max-w-[1120px] px-5 md:px-10 py-12 md:py-20">
        <p className="technical text-[11px] gold-text mb-4">KASA · PODSUMOWANIE ZAMÓWIENIA</p>
        <h1 className="relic-heading text-3xl md:text-5xl mb-10 md:mb-14 leading-[1]">
          Przejdź <span className="gold-text">przez próg</span>
        </h1>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-14 items-start">
          {/* Podsumowanie — na telefonie na górze, na komputerze po prawej */}
          <aside className="lg:order-2 lg:sticky lg:top-28" aria-label="Twoje zamówienie">
            <div className="border hairline bg-[#0D0D0E]">
              <p className="technical text-[11px] gold-text px-5 sm:px-6 pt-5 pb-4 border-b hairline">TWOJE ZAMÓWIENIE</p>
              <ul className="divide-y divide-[#2A2A2C]">
                {items.map((item) => (
                  <li key={item.key || item.id} className="flex gap-4 px-5 sm:px-6 py-4">
                    <div className="relative w-16 h-20 sm:w-20 sm:h-24 bg-[#070708] border hairline overflow-hidden shrink-0">
                      {item.image_url && <Image src={item.image_url} alt="" fittingType="fill" className="absolute inset-0 w-full h-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="relic-heading text-base gold-text leading-snug">{item.name}</p>
                      <p className="font-mono text-xs text-foreground/60 mt-1">{item.qty} × {String(item.price).replace(".", ",")} zł</p>
                      {item.gift && <GiftLine gift={item.gift} />}
                      {item.kind === "bilet" && <TicketLine holders={item.holders} />}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-5 sm:px-6 py-4 border-t hairline">
                <DiscountField items={items} applied={discount} onApply={setDiscount} email={form.email} />
              </div>
              <div className="px-5 sm:px-6 py-5 border-t hairline flex justify-between items-baseline">
                <span className="technical text-[11px] text-foreground/70">DO ZAPŁATY</span>
                <span className="font-mono text-2xl gold-text">{sumPl} zł</span>
              </div>
            </div>
          </aside>

          {/* Formularz */}
          <form onSubmit={submit} className="lg:order-1 space-y-10" noValidate={false}>
            <Step n="01" title="TWOJE DANE">
              <div className="space-y-5">
                <div>
                  <label htmlFor="co-name" className="technical text-[10px] text-foreground/55 block mb-3">IMIĘ I NAZWISKO</label>
                  <input id="co-name" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="co-email" className="technical text-[10px] text-foreground/55 block mb-3">E-MAIL</label>
                  <input id="co-email" autoComplete="email" inputMode="email" required type="email" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} aria-describedby="co-email-hint" />
                  {emailTip ? (
                    <p id="co-email-hint" className="text-sm text-[#E8C547] mt-2" role="status">
                      Czy chodziło Ci o{" "}
                      <button type="button" onClick={() => setForm({ ...form, email: emailTip })} className="underline underline-offset-4 font-medium break-all">{emailTip}</button>?
                    </p>
                  ) : (
                    <p id="co-email-hint" className="text-xs text-foreground/50 mt-2">Na ten adres wyślę potwierdzenie i link do materiałów.</p>
                  )}
                </div>
              </div>
            </Step>

            <Step n="02" title={user ? "LISTY POWROTU" : "KONTO I LISTY POWROTU"} hint="opcjonalnie">
              <div className="space-y-4">
                {!user && <AccountOption items={items} checked={createAccount} onChange={setCreateAccount} />}
                <NewsletterConsent checked={newsletterConsent} onChange={setNewsletterConsent} />
              </div>
            </Step>

            <Step n="03" title="FAKTURA I UWAGI" hint="opcjonalnie">
              <div className="space-y-5">
                <InvoiceFields value={invoice} onChange={setInvoice} />
                {showNote || form.note ? (
                  <div>
                    <label htmlFor="co-note" className="technical text-[10px] text-foreground/55 block mb-3">NOTATKA DO ZAMÓWIENIA</label>
                    <textarea id="co-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`${inputCls} resize-none`} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowNote(true)} className="text-sm text-foreground/60 underline underline-offset-4 hover:text-[#C9A24A]">+ Dodaj notatkę do zamówienia</button>
                )}
              </div>
            </Step>

            <Step n="04" title="ZGODY I INFORMACJE">
              <div className="space-y-5">
                <OrderSummaryInfo items={items} total={sum} />
                <div className="border hairline p-5 space-y-4">
                  <p className="technical text-[10px] text-foreground/55">WYMAGANE DO ZAMÓWIENIA</p>
                  <label className="flex gap-3 text-sm text-foreground/75 leading-relaxed cursor-pointer">
                    <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} />
                    <span>Akceptuję <Link to="/regulamin" target="_blank" rel="noopener" className="underline">Regulamin</Link>.</span>
                  </label>
                  <DigitalConsent items={items} checked={digitalConsent} onChange={setDigitalConsent} />
                  {items.some((i) => i.product_type === "usluga") && (
                    <label className="flex gap-3 text-sm text-foreground/75 leading-relaxed cursor-pointer">
                      <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={serviceConsent} onChange={(e) => setServiceConsent(e.target.checked)} />
                      <span>{TXT.service}</span>
                    </label>
                  )}
                  <p className="text-xs text-foreground/50">Dane przetwarzam do realizacji zamówienia: <Link to="/polityka-prywatnosci" target="_blank" rel="noopener" className="underline">Polityka prywatności</Link>.</p>
                </div>
              </div>
            </Step>

            <div className="border-t hairline pt-8 space-y-4">
              {cartNote && <p className="text-sm text-foreground/70" role="status">{cartNote}</p>}
              {payError && <p className="text-sm text-[#E8C547] border border-[#E8C547]/40 px-4 py-3" role="alert">{payError}</p>}
              <div className="flex justify-between items-baseline">
                <span className="technical text-[11px] text-foreground/70">DO ZAPŁATY</span>
                <span className="font-mono text-3xl gold-text">{sumPl} zł</span>
              </div>
              {form.email.trim() && (
                <p className="text-sm text-foreground/65 leading-relaxed">
                  Potwierdzenie i materiały wyślę na adres: <span className="text-foreground break-all">{form.email.trim()}</span>{" "}
                  · <a href="#co-email" onClick={(e) => { e.preventDefault(); const el = document.getElementById("co-email"); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus({ preventScroll: true }); }} className="underline underline-offset-4 hover:text-[#C9A24A]">zmień</a>
                </p>
              )}
              <button type="submit" disabled={submitting} className="btn-relic w-full !py-5 text-base disabled:opacity-60">
                {submitting ? "PRZYGOTOWUJĘ PŁATNOŚĆ..." : "Zamawiam z obowiązkiem zapłaty"}{" "}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="flex items-center justify-center gap-2 text-xs text-foreground/55 text-center">
                <Lock className="h-3.5 w-3.5" /> Bezpieczna płatność online przez PayU · potwierdzenie otrzymasz w wiadomości e-mail
              </p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
