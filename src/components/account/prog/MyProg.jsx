import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

// Moje konto → „Rozmowa na progu” (18.11.2026): status, termin, informacje organizacyjne i podsumowanie.
// Dane z funkcji progUczestnik — wyłącznie zgłoszenia na adres e-mail zalogowanego konta.
const dt = (v) => (v ? new Date(v).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "full", timeStyle: "short" }) : "");
const card = "border hairline rounded-2xl p-5 md:p-6 bg-[#0D0D0E]";

function Item({ it, go, onRead }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (it.summary && !it.read_at) onRead(it.id); }, [it.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = async () => {
    setBusy(true); setErr("");
    try {
      const r = await base44.functions.invoke("progUczestnik", { action: "pay_link", id: it.id });
      window.location.href = `/rozmowa-na-progu/zgloszenie?t=${r.data.token}`;
    } catch (e) { setErr(e?.response?.data?.error || "Nie udało się przygotować płatności."); setBusy(false); }
  };
  return (
    <div className={card}>
      <p className="technical text-[10px] gold-text mb-2">{it.status_label}</p>
      <h3 className="shop-heading text-2xl text-[#F5EFE1] mb-3">Rozmowa na progu</h3>
      {it.status === "do_platnosci" && (
        <>
          <p className="text-foreground/70">Zgłoszenie jest przyjęte. Kolejny krok to płatność, a po niej wybór terminu.</p>
          <button onClick={pay} disabled={busy} className="btn-relic !min-h-[44px] !py-2 !px-5 text-sm mt-4">{busy ? "Przygotowuję…" : "Przejdź do płatności"}</button>
        </>
      )}
      {it.status === "oplacone" && (
        <>
          <p className="text-foreground/70">Płatność przyjęta. Wybierz termin spotkania — link otrzymałeś w wiadomości e-mail, a termin możesz też umówić tutaj.</p>
          <button onClick={() => go("sesje")} className="btn-relic !min-h-[44px] !py-2 !px-5 text-sm mt-4">Wybierz termin</button>
        </>
      )}
      {it.status === "termin_wybrany" && (
        <>
          <p className="text-foreground/75">Termin: <span className="gold-text">{dt(it.starts_at)}</span> (czasu polskiego), 90 minut, online.</p>
          <p className="text-sm text-foreground/60 mt-2">Link do spotkania znajdziesz w zakładce „Umów spotkanie” — działa od 15 minut przed terminem. Termin możesz bezpłatnie przełożyć najpóźniej 24 godziny przed spotkaniem.</p>
          <p className="text-sm text-foreground/60 mt-2">Nie musisz przygotowywać się w szczególny sposób. Wystarczy spokojne miejsce, słuchawki i kilka minut przed spotkaniem na zastanowienie się, z czym przychodzisz.</p>
          <button onClick={() => go("sesje")} className="btn-ghost !min-h-[44px] !py-2 !px-5 text-sm mt-4">Szczegóły i zmiana terminu</button>
        </>
      )}
      {["odbyta", "nieobecnosc", "anulowana"].includes(it.status) && it.starts_at && (
        <p className="text-sm text-foreground/60">Termin spotkania: {dt(it.starts_at)}.</p>
      )}
      {it.status === "odbyta" && it.podsumowanie_chce && !it.summary && (
        <p className="text-foreground/70 mt-3">Pisemne podsumowanie przygotowuję w ciągu 48 godzin po spotkaniu. Otrzymasz powiadomienie w wiadomości e-mail.</p>
      )}
      {it.summary && (
        <div className="mt-5 border-t hairline pt-5">
          <p className="technical text-[10px] gold-text mb-3">PODSUMOWANIE SPOTKANIA{it.shared_at ? ` · ${new Date(it.shared_at).toLocaleDateString("pl-PL")}` : ""}</p>
          <div className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{it.summary}</div>
        </div>
      )}
      {err && <p className="text-sm blood-text mt-3">{err}</p>}
    </div>
  );
}

export default function MyProg({ data, go }) {
  if (!data?.has) return null;
  const read = (id) => base44.functions.invoke("progUczestnik", { action: "read", id }).catch(() => {});
  return (
    <div className="space-y-5">
      {data.items.map((it) => <Item key={it.id} it={it} go={go} onRead={read} />)}
      <p className="text-xs text-foreground/50 leading-relaxed">
        Rozmowa na progu jest spotkaniem mentoringowym, niezależnym od programu POWRÓT. Nie jest psychoterapią, diagnozą ani pomocą w kryzysie.
        W nagłej sytuacji: 116 123, 800 70 2222, a w zagrożeniu życia 112. Zasady: <Link to="/regulamin" className="underline">Regulamin</Link>.
      </p>
    </div>
  );
}
