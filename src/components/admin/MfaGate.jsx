import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { supaMfa } from "@/api/exmAuth";

// Weryfikacja dwuetapowa w panelu (audyt bezpieczeństwa 16.11.2026).
// - Konto z włączonym kodem, sesja bez kodu (logowanie hasłem, Google, link) → najpierw kod z aplikacji.
//   Serwer i tak odmawia wtedy uprawnień obsługi (compat.ts → me()), więc to nie tylko zasłona w przeglądarce.
// - Konto bez kodu → pasek z zachętą i kreatorem włączenia (QR + kod).
const inputCls = "w-full bg-transparent border hairline px-5 py-4 text-center font-mono text-2xl tracking-[0.4em] focus:border-[#C9A24A] focus:outline-none";

function CodeForm({ onSubmit, busy, error, label = "POTWIERDŹ" }) {
  const [code, setCode] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.replace(/\D/g, "").length === 6) onSubmit(code); }} className="space-y-4">
      <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} className={inputCls} placeholder="000000" aria-label="Kod z aplikacji" />
      {error && <p className="text-sm text-[#E8C547]" role="alert">{error}</p>}
      <button type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6} className="btn-relic w-full disabled:opacity-50">
        {busy ? "SPRAWDZAM…" : label}
      </button>
    </form>
  );
}

function Enroll({ onDone, onCancel }) {
  const [f, setF] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { supaMfa.enroll().then(setF).catch((e) => setErr(e.message || "Nie udało się rozpocząć")); }, []);
  const verify = async (code) => {
    setBusy(true); setErr("");
    try { await supaMfa.verify(f.id, code); onDone(); } catch { setErr("Kod się nie zgadza. Sprawdź godzinę w telefonie i wpisz aktualny kod."); }
    setBusy(false);
  };
  return (
    <div className="border hairline p-6 md:p-8 max-w-xl space-y-5">
      <p className="technical text-[10px] gold-text">WŁĄCZ WERYFIKACJĘ DWUETAPOWĄ</p>
      <ol className="text-sm text-foreground/75 leading-relaxed list-decimal pl-5 space-y-1">
        <li>Zainstaluj w telefonie aplikację z kodami (np. Google Authenticator, Microsoft Authenticator, 1Password).</li>
        <li>Zeskanuj kod QR albo wpisz klucz ręcznie.</li>
        <li>Wpisz 6-cyfrowy kod, który pokaże aplikacja.</li>
      </ol>
      {f?.qr ? (
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <img src={f.qr} alt="Kod QR do aplikacji uwierzytelniającej" className="w-44 h-44 bg-white p-2 rounded-sm" />
          <div className="text-xs text-foreground/60 break-all">
            <p className="technical text-[10px] text-foreground/50 mb-1">KLUCZ (gdy nie możesz zeskanować)</p>
            <span className="font-mono text-foreground/85">{f.secret}</span>
          </div>
        </div>
      ) : !err && <p className="text-sm text-foreground/55">Przygotowuję kod…</p>}
      {f && <CodeForm onSubmit={verify} busy={busy} error={err} label="WŁĄCZ" />}
      {!f && err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      <button type="button" onClick={onCancel} className="text-sm text-foreground/55 underline underline-offset-4">Nie teraz</button>
    </div>
  );
}

export default function MfaGate({ children }) {
  const [st, setSt] = useState(undefined); // undefined = sprawdzam, null = brak danych (puszczamy panel)
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [enroll, setEnroll] = useState(false);
  useEffect(() => { supaMfa.state().then(setSt).catch(() => setSt(null)); }, []);

  if (st === undefined) {
    return <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" /></div>;
  }

  // Kod włączony, sesja bez kodu → najpierw kod.
  if (st && st.verified.length && st.aal !== "aal2") {
    const verify = async (code) => {
      setBusy(true); setErr("");
      try { await supaMfa.verify(st.verified[0].id, code); window.location.reload(); }
      catch { setErr("Kod się nie zgadza. Wpisz aktualny kod z aplikacji."); setBusy(false); }
    };
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="max-w-sm w-full space-y-6 text-center">
          <ShieldCheck className="h-10 w-10 gold-text mx-auto" />
          <p className="relic-heading text-2xl">Kod z aplikacji</p>
          <p className="text-sm text-foreground/60">Panel wymaga drugiego kroku logowania. Wpisz 6-cyfrowy kod z aplikacji uwierzytelniającej.</p>
          <CodeForm onSubmit={verify} busy={busy} error={err} />
        </div>
      </div>
    );
  }

  return (
    <>
      {st && !st.verified.length && (
        enroll ? (
          <div className="mb-10"><Enroll onDone={() => window.location.reload()} onCancel={() => setEnroll(false)} /></div>
        ) : (
          <div className="mb-10 border border-[#E8C547]/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="flex items-start gap-3 text-sm text-foreground/80">
              <ShieldAlert className="h-5 w-5 text-[#E8C547] shrink-0 mt-0.5" />
              Panel chroni teraz tylko hasło. Włącz weryfikację dwuetapową — do logowania będzie potrzebny też kod z telefonu.
            </p>
            <button type="button" onClick={() => setEnroll(true)} className="btn-relic shrink-0">WŁĄCZ</button>
          </div>
        )
      )}
      {children}
    </>
  );
}
