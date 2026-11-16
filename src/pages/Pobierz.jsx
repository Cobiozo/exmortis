import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Download, PlayCircle, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useDocMeta } from "@/lib/useDocMeta";
import { track } from "@/lib/track";

// Materiały z zakupu bez konta: /pobierz#t=TOKEN (z maila albo ze strony po zapłacie), &a=1 — od razu „Aktywuj konto”.
// Bez tokenu: formularz „wyślij mi nowy link” (na adres z zamówienia).
const call = (data) => base44.functions.invoke("orderAccess", data).then((r) => r.data);
const errText = (e, fb) => e?.response?.data?.error || fb;

function ResendForm({ token, note }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState(""); // "" | busy | sent | error
  const [msg, setMsg] = useState("");
  const send = async (e) => {
    e?.preventDefault();
    setState("busy");
    try {
      await call(token ? { action: "resend", t: token } : { action: "resend", email });
      setState("sent");
    } catch (err) { setMsg(errText(err, "Nie udało się wysłać. Spróbuj za chwilę.")); setState("error"); }
  };
  if (state === "sent") {
    return (
      <p className="text-foreground/70 leading-relaxed" role="status">
        Jeśli ten adres ma opłacone zamówienie z materiałami, nowy link jest już w drodze. Sprawdź też folder „Oferty” i spam.
      </p>
    );
  }
  return (
    <form onSubmit={send} className="space-y-4">
      {note && <p className="text-foreground/60 leading-relaxed">{note}</p>}
      {!token && (
        <div>
          <label htmlFor="pb-email" className="technical text-[10px] text-foreground/55 block mb-3">E-MAIL Z ZAMÓWIENIA</label>
          <input id="pb-email" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent border hairline px-5 py-4 focus:border-[#C9A24A] focus:outline-none transition-colors" />
        </div>
      )}
      <button type="submit" disabled={state === "busy"} className="btn-relic disabled:opacity-60">
        {state === "busy" ? "WYSYŁAM..." : "WYŚLIJ MI NOWY LINK"} <ArrowRight className="h-4 w-4" />
      </button>
      {state === "error" && <p className="text-sm text-[#E8C547]" role="alert">{msg}</p>}
    </form>
  );
}

export default function Pobierz() {
  useDocMeta("Twoje materiały — exmortis", "Pobierz materiały z zamówienia i aktywuj bezpłatne konto exmortis.");
  const navigate = useNavigate();
  const { checkUserAuth, user } = useAuth();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("t") || "");
  const [autoActivate] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("a") === "1");
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [fileMsg, setFileMsg] = useState("");
  const [act, setAct] = useState(null); // { exists } | { done, code }

  useEffect(() => {
    if (!token) return;
    // Token zostaje w pamięci strony, ale znika z paska adresu (zrzuty ekranu, udostępnianie).
    try { window.history.replaceState(null, "", window.location.pathname); } catch { /* */ }
    call({ action: "info", t: token }).then(setInfo).catch((e) => setError(errText(e, "Nie udało się otworzyć linku.")));
  }, [token]);

  const activate = async () => {
    setBusy("activate"); setFileMsg("");
    try {
      const r = await call({ action: "activate", t: token });
      if (r.exists) { setAct({ exists: true }); return; }
      await base44.auth.loginWithTokenHash(r.token_hash);
      track("CompleteRegistration", { content_name: "konto po zakupie" });
      await checkUserAuth?.();
      setAct({ done: true, code: r.code });
    } catch (e) {
      setFileMsg(errText(e, "Nie udało się aktywować konta. Spróbuj ponownie albo napisz do mnie."));
    } finally { setBusy(""); }
  };

  useEffect(() => {
    if (autoActivate && info && !info.account && info.can_activate && !act && !user) activate();
    // jednorazowo po wczytaniu linku z przycisku „Aktywuj konto”
  }, [info]);

  const download = async (m) => {
    setBusy(m.id); setFileMsg("");
    try {
      const r = await call({ action: "file", t: token, product_id: m.id });
      const a = document.createElement("a");
      a.href = r.url; a.download = r.name || "plik"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setFileMsg("Pobieranie rozpoczęte. Plik jest Twoją osobistą kopią.");
    } catch (e) {
      if (e?.response?.data?.expired) setInfo((i) => ({ ...i, expired: true }));
      setFileMsg(errText(e, "Nie udało się pobrać pliku. Spróbuj za chwilę."));
    } finally { setBusy(""); }
  };

  const shell = (children) => (
    <div className="bg-[#0A0A0B] pt-20 min-h-screen">
      <section className="mx-auto max-w-[760px] px-5 md:px-10 py-16 md:py-24">
        <p className="technical text-[11px] gold-text mb-6">TWOJE MATERIAŁY</p>
        {children}
      </section>
    </div>
  );

  if (!token) {
    return shell(<>
      <h1 className="relic-heading text-4xl md:text-5xl mb-6">Nie masz linku?</h1>
      <p className="text-foreground/70 leading-relaxed mb-10">Podaj adres e-mail z zamówienia — wyślę na niego nowy link do Twoich materiałów. Link jest ważny 7 dni.</p>
      <ResendForm />
      <p className="text-sm text-foreground/55 mt-10">Masz konto exmortis? Wszystkie zakupy są w <Link to="/konto" className="gold-text hover:underline">Moich produktach</Link>.</p>
    </>);
  }
  if (error) {
    return shell(<>
      <h1 className="relic-heading text-4xl md:text-5xl mb-6">Ten link nie działa</h1>
      <ResendForm note={`${error} Podaj adres z zamówienia, a wyślę nowy.`} />
    </>);
  }
  if (!info) {
    return shell(<div className="flex items-center gap-4 py-10" role="status"><div className="w-6 h-6 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /><span className="text-foreground/60">Otwieram Twoje materiały…</span></div>);
  }
  if (info.pending) {
    return shell(<>
      <h1 className="relic-heading text-4xl md:text-5xl mb-6">Czekam na potwierdzenie płatności</h1>
      <p className="text-foreground/70 leading-relaxed mb-8">PayU jeszcze nie potwierdziło płatności. Zwykle trwa to kilka minut — ten sam link otrzymasz również w wiadomości e-mail.</p>
      <button type="button" onClick={() => window.location.reload()} className="btn-ghost">SPRAWDŹ PONOWNIE</button>
    </>);
  }

  const files = info.materials.filter((m) => !m.account_only);
  const courses = info.materials.filter((m) => m.account_only);
  const loggedIn = !!user || act?.done;

  return shell(<>
    <h1 className="relic-heading text-4xl md:text-5xl mb-4">{info.name ? `${info.name}, Twoje materiały` : "Twoje materiały"}</h1>
    <p className="technical text-[10px] text-foreground/55 mb-12">ZAMÓWIENIE {info.order} · {info.email}</p>

    {files.length > 0 && (
      <div className="border hairline divide-y divide-[#2A2A2C] mb-10">
        {files.map((m) => (
          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between p-5">
            <div className="min-w-0">
              <p className="relic-heading text-lg gold-text">{m.name}</p>
              <p className="technical text-[10px] text-foreground/55 mt-1">{m.type === "audio" ? "AUDIO" : "E-BOOK · PDF Z TWOIM ZNAKIEM WODNYM"}</p>
            </div>
            {info.expired ? null : (
              <button type="button" onClick={() => download(m)} disabled={!!busy || !m.has_file} className="btn-relic shrink-0 disabled:opacity-60">
                {busy === m.id ? "PRZYGOTOWUJĘ..." : m.has_file ? "POBIERZ" : "PLIK W PRZYGOTOWANIU"} <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    )}
    {fileMsg && <p className="text-sm text-foreground/70 -mt-6 mb-10" role="status">{fileMsg}</p>}
    {info.expired && files.length > 0 && (
      <div className="border hairline p-6 mb-10">
        <p className="technical text-[10px] gold-text mb-4">LINK WYGASŁ</p>
        <ResendForm token={token} note="Link do pobrania działa 7 dni. Wyślę nowy na adres z zamówienia." />
      </div>
    )}

    {courses.length > 0 && (
      <div className="border hairline p-6 mb-10">
        <p className="technical text-[10px] gold-text mb-4">{courses.length > 1 ? "KURSY" : "KURS"} NA TWOIM KONCIE</p>
        {courses.map((m) => <p key={m.id} className="relic-heading text-lg mb-2">{m.name}</p>)}
        {loggedIn || info.account ? (
          <Link to="/konto" className="btn-relic mt-4">OTWÓRZ KURS <PlayCircle className="h-4 w-4" /></Link>
        ) : (
          <p className="text-foreground/60 leading-relaxed mt-2">Kurs oglądasz na bezpłatnym koncie — aktywujesz je przyciskiem poniżej, bez hasła.</p>
        )}
      </div>
    )}

    {act?.done ? (
      <div className="border border-[#C9A24A]/60 p-6 md:p-8">
        <p className="flex items-center gap-3 relic-heading text-2xl gold-text mb-3"><Check className="h-6 w-6" /> Konto gotowe</p>
        <p className="text-foreground/70 leading-relaxed">Zakup jest już w Moich produktach, razem z ROZDROŻAMI i Biblioteką.{act.code ? " Kod 20 zł na kolejny materiał wysłałem e-mailem — znajdziesz go także w powiadomieniach." : ""}</p>
        <p className="text-sm text-foreground/55 leading-relaxed mt-3">Hasło możesz ustawić później: na stronie logowania „Nie pamiętam hasła”. Z adresem Gmail wejdziesz też przez Google.</p>
        <button type="button" onClick={() => navigate("/konto")} className="btn-relic mt-6">PRZEJDŹ DO KONTA <ArrowRight className="h-4 w-4" /></button>
      </div>
    ) : act?.exists || (info.account && !user) ? (
      <div className="border hairline p-6">
        <p className="text-foreground/70 leading-relaxed">Ten adres ma już konto exmortis — zakup jest w Moich produktach.</p>
        <Link to="/login?returnTo=%2Fkonto" className="btn-ghost mt-5">ZALOGUJ SIĘ</Link>
      </div>
    ) : loggedIn ? null : info.can_activate ? (
      <div className="border hairline p-6 md:p-8">
        <p className="technical text-[10px] gold-text mb-4">BEZPŁATNE KONTO EXMORTIS</p>
        <p className="relic-heading text-2xl mb-4">Zakup już czeka na Twoim koncie</p>
        <ul className="space-y-2 text-foreground/70 mb-6">
          <li>· zakupy zawsze dostępne w jednym miejscu</li>
          <li>· aktualizacje e-booka</li>
          <li>· ROZDROŻA i Biblioteka</li>
          <li>· 20 zł na kolejny materiał (od 49 zł, ważne 30 dni)</li>
        </ul>
        <button type="button" onClick={activate} disabled={!!busy} className="btn-relic disabled:opacity-60">
          {busy === "activate" ? "ZAKŁADAM KONTO..." : courses.length ? "AKTYWUJ DOSTĘP I KONTO" : "AKTYWUJ KONTO"} <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-xs text-foreground/55 leading-relaxed mt-4">
          Jedno kliknięcie zakłada konto na adres {info.email} i od razu loguje. Zasady: <Link to="/regulamin" className="underline">Regulamin</Link> i <Link to="/polityka-prywatnosci" className="underline">Polityka prywatności</Link>. Konto usuniesz w każdej chwili w ustawieniach.
        </p>
      </div>
    ) : null}
  </>);
}
