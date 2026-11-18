import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Download } from "lucide-react";
import ChooseTermButton from "@/components/exmortis/shop/ChooseTermButton";

// Ekrany po powrocie z PayU: sprawdzanie, przyjęta płatność, oczekiwanie, anulowanie, błąd.
// Logika i kolejność kroków bez zmian — inny jest tylko układ i tytuł.
export default function CheckoutResult({ payState, canceled, doneLink, doneEmail, user, onRecheck }) {
  const frame = (children) => (
    <div className="bg-exm-bg pt-20">
      <div className="mx-auto flex min-h-[70svh] w-full max-w-[var(--exm-container-narrow)] flex-col items-center justify-center gap-5 px-[var(--exm-pad)] py-16 text-center">
        <p className="exm-eyebrow">exmortis</p>
        {children}
      </div>
    </div>
  );

  if (payState === "check") {
    return frame(
      <>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-exm-line border-t-exm-gold motion-reduce:animate-none" aria-hidden="true" />
        <p className="text-[16px] text-exm-muted" role="status">Sprawdzam płatność w PayU…</p>
      </>
    );
  }

  if (payState === "fail") {
    return frame(
      <>
        <h1 className="exm-h2">{canceled ? "Płatność anulowana" : "Płatność nie powiodła się"}</h1>
        <p className="max-w-[52ch] text-[16px] leading-relaxed text-exm-muted">
          Nic nie zostało pobrane albo PayU zwróci środki. Koszyk czeka — możesz spróbować jeszcze raz.
        </p>
        <Link to="/kasa" className="btn-relic">Wróć do kasy <ArrowRight className="h-4 w-4" /></Link>
      </>
    );
  }

  if (payState === "wait") {
    return frame(
      <>
        <h1 className="exm-h2">Czekamy na potwierdzenie płatności</h1>
        <p className="max-w-[52ch] text-[16px] leading-relaxed text-exm-muted">
          PayU jeszcze nie potwierdziło płatności. Nie traktujemy jej jako opłaconej, dopóki nie dotrze
          powiadomienie z bramki. Koszyk zostaje na swoim miejscu, a dostęp i szczegóły otrzymasz w wiadomości e-mail —
          zwykle w kilka minut.
        </p>
        <button type="button" onClick={onRecheck} className="btn-ghost">Sprawdź ponownie</button>
        <Link to="/kontakt" className="btn-link">Napisz, jeżeli płatność nie dotarła</Link>
      </>
    );
  }

  return frame(
    <>
      <div className="grid h-14 w-14 place-items-center rounded-full border border-exm-gold-line" aria-hidden="true">
        <Check className="h-7 w-7 text-exm-gold" />
      </div>
      <h1 className="exm-h2">Płatność przyjęta</h1>
      <p className="max-w-[52ch] text-[16px] leading-relaxed text-exm-muted">
        {doneLink ? "Potwierdzenie zamówienia i link do materiałów wysłałem" : "Potwierdzenie zamówienia wysłałem"} na Twój adres e-mail.
      </p>

      {doneEmail && (
        <p className="max-w-[52ch] text-[14px] leading-relaxed text-exm-muted">
          Wiadomość wysłałem na adres <span className="text-exm-text break-all">{doneEmail}</span>. Jeśli nie dotrze w ciągu kilku minut, sprawdź folder „Spam” lub{" "}
          <Link to="/kontakt" className="text-exm-gold underline underline-offset-4">napisz do mnie</Link> — w razie błędu w adresie wyślę materiały ponownie.
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        {doneLink && (
          <a href={`/pobierz#t=${doneLink}`} className="btn-relic">Pobierz materiały <Download className="h-4 w-4" /></a>
        )}
        <ChooseTermButton />
        {user ? (
          <Link to="/konto" className="btn-ghost">Moje produkty</Link>
        ) : doneLink ? (
          <div className="mt-2 max-w-[52ch] rounded-[var(--exm-r-card)] border border-exm-line bg-exm-surface p-5 text-left">
            <p className="exm-eyebrow mb-3">Bezpłatne konto exmortis</p>
            <p className="text-[14px] leading-relaxed text-exm-muted">Załóż je jednym kliknięciem na ten sam adres — zakup już tam czeka. Dostaniesz też ROZDROŻA, Bibliotekę i 20 zł na kolejny materiał.</p>
            <a href={`/pobierz#t=${doneLink}&a=1`} className="btn-ghost mt-4">Aktywuj konto <ArrowRight className="h-4 w-4" /></a>
          </div>
        ) : null}
      </div>
    </>
  );
}