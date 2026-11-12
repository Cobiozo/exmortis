import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { POWROT, POWROT_INCLUDES } from "@/lib/powrotOffer";
import InvoiceFields, { validNip } from "@/components/exmortis/shop/InvoiceFields";
import { usePageMeta } from "@/lib/usePageMeta";

const ORDER_KEY = "exm_powrot_order";
const zl = (n) => `${Number(n || 0).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`;
const plDate = (v) => (v ? new Date(v).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "");

// Osobisty link do płatności za program POWRÓT (z e-maila po rozmowie kwalifikacyjnej).
export default function PowrotPlatnosc() {
  usePageMeta({ noindex: true });
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t") || "";
  const back = params.get("payu") === "done";
  const payuError = !!params.get("error");

  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [contract, setContract] = useState(false);
  const [early, setEarly] = useState(false);
  const [invoice, setInvoice] = useState({ want: false, company: "", nip: "", address: "" });
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState("");
  const [payState, setPayState] = useState(back ? (payuError ? "fail" : "check") : null); // check | ok | wait | fail

  useEffect(() => {
    base44.functions.invoke("payuCreateOrder", { action: "powrot.info", token })
      .then((r) => setInfo(r.data))
      .catch((e) => setLoadError(e?.response?.data?.error || "Nie udało się wczytać płatności. Odśwież stronę albo napisz do mnie."));
  }, [token]);

  // Powrót z PayU: stan zamówienia (powiadomienie PayU bywa kilka sekund po powrocie).
  useEffect(() => {
    if (payState !== "check") return undefined;
    let stop = false, tries = 0, orderId = "";
    try { orderId = sessionStorage.getItem(ORDER_KEY) || ""; } catch { /* brak */ }
    const tick = async () => {
      if (stop) return;
      tries++;
      const st = orderId
        ? await base44.functions.invoke("payuCreateOrder", { action: "status", orderId }).then((r) => r.data?.status).catch(() => null)
        : await base44.functions.invoke("payuCreateOrder", { action: "powrot.info", token }).then((r) => (r.data?.paid ? "COMPLETED" : null)).catch(() => null);
      if (stop) return;
      if (st === "COMPLETED") {
        try { sessionStorage.removeItem(ORDER_KEY); } catch { /* */ }
        setPayState("ok");
        return;
      }
      if (st === "CANCELED") { setPayState("fail"); return; }
      if (tries >= 20) { setPayState("wait"); return; }
      setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [payState, token]);

  const pay = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (invoice.want && !validNip(invoice.nip)) { setPayError("Sprawdź NIP do faktury — powinien mieć 10 cyfr."); return; }
    setBusy(true);
    setPayError("");
    try {
      const r = await base44.functions.invoke("payuCreateOrder", {
        action: "powrot.pay", token, contract_consent: contract, early_consent: early, invoice: invoice.want ? invoice : null,
      });
      if (!r.data?.redirectUri) throw new Error("Brak adresu płatności");
      try { sessionStorage.setItem(ORDER_KEY, r.data.orderId || ""); } catch { /* */ }
      window.location.href = r.data.redirectUri;
    } catch (err) {
      setPayError(err?.response?.data?.error || "Nie udało się rozpocząć płatności. Spróbuj ponownie.");
      setBusy(false);
    }
  };

  const shell = (children) => (
    <div className="min-h-screen bg-[#0A0A0B] pt-28 pb-24 px-5 md:px-10">
      <div className="mx-auto max-w-2xl space-y-8">{children}</div>
    </div>
  );

  if (payState === "check") {
    return shell(
      <div className="flex flex-col items-center text-center gap-6 pt-16">
        <Loader2 className="h-8 w-8 animate-spin gold-text" />
        <p className="text-foreground/60 text-lg" role="status">Sprawdzam płatność w PayU…</p>
      </div>
    );
  }
  if (payState === "ok") {
    return shell(
      <div className="flex flex-col items-center text-center gap-6 pt-10">
        <div className="w-16 h-16 border-2 border-[#C9A24A] rounded-full flex items-center justify-center"><Check className="h-8 w-8 gold-text" /></div>
        <h1 className="relic-heading text-4xl md:text-5xl gold-text">Zaczynamy POWRÓT</h1>
        <p className="text-foreground/65 text-lg leading-relaxed max-w-md">
          Płatność dotarła. Potwierdzenie i umowa są w drodze na Twój e-mail. Odezwę się w ciągu kilku dni, żeby ustalić termin pierwszej sesji.
        </p>
      </div>
    );
  }
  if (payState === "wait" || payState === "fail") {
    const fail = payState === "fail";
    return shell(
      <div className="flex flex-col items-center text-center gap-6 pt-10">
        <h1 className="relic-heading text-3xl md:text-5xl">{fail ? "Płatność nie doszła do skutku" : "Płatność w weryfikacji"}</h1>
        <p className="text-foreground/60 text-lg leading-relaxed max-w-md">
          {fail
            ? "Nic nie zostało pobrane albo PayU zwróci środki. Możesz spróbować jeszcze raz — link jest nadal ważny."
            : "PayU jeszcze nie potwierdziło płatności. Potwierdzenie wyślę e-mailem, zwykle w kilka minut."}
        </p>
        {fail
          ? <button type="button" className="btn-relic" onClick={() => { setPayState(null); window.history.replaceState(null, "", `/powrot/platnosc?t=${token}`); }}>SPRÓBUJ PONOWNIE <ArrowRight className="h-4 w-4" /></button>
          : <button type="button" className="btn-ghost" onClick={() => setPayState("check")}>SPRAWDŹ PONOWNIE</button>}
        <Link to="/kontakt" className="technical text-[10px] text-foreground/55 hover:gold-text">NAPISZ DO MNIE</Link>
      </div>
    );
  }

  if (loadError) {
    return shell(
      <div className="text-center space-y-6 pt-10">
        <h1 className="relic-heading text-3xl md:text-4xl">Płatność za program POWRÓT</h1>
        <p className="text-foreground/65">{loadError}</p>
        <Link to="/kontakt" className="btn-ghost">NAPISZ DO MNIE</Link>
      </div>
    );
  }
  if (!info) return shell(<div className="flex justify-center pt-16"><Loader2 className="h-8 w-8 animate-spin gold-text" /></div>);

  if (info.paid || info.expired || !info.umowa) {
    return shell(
      <div className="text-center space-y-6 pt-10">
        <h1 className="relic-heading text-3xl md:text-4xl">{info.paid ? "Program jest opłacony" : "Link wygasł"}</h1>
        <p className="text-foreground/65 leading-relaxed">
          {info.paid
            ? "Potwierdzenie i umowa są w Twojej skrzynce e-mail. Do zobaczenia na pierwszej sesji."
            : info.umowa
              ? "Link do płatności był ważny 7 dni. Napisz do mnie — wyślę nowy."
              : "Płatność jest chwilowo niedostępna. Napisz do mnie."}
        </p>
        {!info.paid && <Link to="/kontakt" className="btn-ghost">NAPISZ DO MNIE</Link>}
      </div>
    );
  }

  return shell(
    <>
      <div className="space-y-3">
        <p className="technical text-[11px] gold-text">PROGRAM POWRÓT · PŁATNOŚĆ</p>
        <h1 className="relic-heading text-3xl md:text-5xl">{info.name ? `${info.name}, ` : ""}zaczynamy</h1>
        <p className="text-foreground/65 leading-relaxed">
          Dziękuję za rozmowę. Poniżej jest podsumowanie programu, umowa i płatność. Link jest ważny do {plDate(info.expires_at)}.
        </p>
      </div>

      <div className="border hairline p-6 space-y-4">
        <div className="flex justify-between items-baseline gap-4 pb-4 border-b hairline">
          <p className="relic-heading text-xl gold-text">Program POWRÓT</p>
          <p className="font-mono text-2xl gold-text whitespace-nowrap">{zl(info.amount)}</p>
        </div>
        <p className="text-sm text-foreground/70">
          {POWROT.sessions} sesji 1:1 po {POWROT.length} · {POWROT.cadence} · {POWROT.months} · online ({POWROT.form})
        </p>
        <ul className="text-sm text-foreground/65 space-y-1.5 list-disc pl-5">
          {POWROT_INCLUDES.map((x) => <li key={x}>{x}</li>)}
        </ul>
        <p className="text-xs text-foreground/55">Cena końcowa — sprzedawca zwolniony z VAT. Termin pierwszej sesji ustalimy po zawarciu umowy.</p>
      </div>

      <form onSubmit={pay} className="space-y-6">
        <InvoiceFields value={invoice} onChange={setInvoice} />

        <label className="flex gap-3 text-sm text-foreground/70 leading-relaxed cursor-pointer">
          <input type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={contract} onChange={(e) => setContract(e.target.checked)} />
          <span>
            Akceptuję{" "}
            <Link to="/umowa-powrot" target="_blank" rel="noopener" className="underline">Umowę o udział w programie POWRÓT</Link>
            {" "}(wersja {info.umowa.version}) oraz{" "}
            <Link to="/regulamin" target="_blank" rel="noopener" className="underline">Regulamin</Link>.
          </span>
        </label>

        <label className="flex gap-3 text-sm text-foreground/65 leading-relaxed cursor-pointer">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#C9A24A]" checked={early} onChange={(e) => setEarly(e.target.checked)} />
          <span>
            Chcę, żeby pierwsza sesja mogła się odbyć wcześniej niż 14 dni od zawarcia umowy. Wiem, że jeśli odstąpię od umowy,
            zapłacę za zrealizowaną część programu, a po jego pełnym wykonaniu utracę prawo odstąpienia.{" "}
            <span className="text-foreground/45">(Opcjonalne — bez tej zgody pierwsza sesja odbędzie się po 14 dniach.)</span>
          </span>
        </label>

        {payError && <p className="text-sm text-[#E8C547]" role="alert">{payError}</p>}
        <button type="submit" disabled={busy} className="btn-relic w-full disabled:opacity-60">
          {busy ? "PRZYGOTOWUJĘ PŁATNOŚĆ..." : "Zamawiam z obowiązkiem zapłaty"} {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
        <p className="text-xs text-foreground/55 leading-relaxed">
          Bezpieczna płatność przez PayU: BLIK, przelew, karta — a także płatność odroczona lub w ratach PayPo, jeśli PayPo
          udostępni ją dla Twojej płatności (umowę o raty zawierasz z PayPo). Zasady przetwarzania danych:{" "}
          <Link to="/polityka-prywatnosci" className="underline">Polityka prywatności</Link>.
        </p>
      </form>
    </>
  );
}
