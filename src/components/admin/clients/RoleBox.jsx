import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Rola konta (16.11.2026). Zmienia ją wyłącznie serwer (adminClients → set_role):
// bez zmiany własnej roli, bez odbierania uprawnień ostatniemu administratorowi, wpis w dzienniku bezpieczeństwa.
const ROLES = [
  ["user", "Klient", "Konto klienta: zakupy, materiały, spotkania."],
  ["techniczna", "Techniczna", "Treści stron, menu i stopka, ustawienia, integracje (bez kluczy PayU), Cisza. Bez zamówień, przychodów, kontaktów i danych osobowych."],
  ["admin", "Administrator", "Pełny dostęp do panelu, w tym zamówień, kontaktów i danych osobowych."],
];

export default function RoleBox({ email, onChange }) {
  const [cur, setCur] = useState(null);
  const [self, setSelf] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false); // drugi klik = potwierdzenie (bez okien przeglądarki)

  useEffect(() => {
    base44.functions.invoke("adminClients", { action: "role", email })
      .then((r) => { setCur(r.data.role); setPick(r.data.role); setSelf(!!r.data.self); setLocked(!!r.data.locked); })
      .catch(() => setCur(undefined));
  }, [email]);

  if (cur === undefined) return null; // brak profilu — sekcja się nie pokazuje
  if (cur === null) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;

  const save = async () => {
    if (!sure) { setSure(true); return; }
    setSure(false);
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await base44.functions.invoke("adminClients", { action: "set_role", email, role: pick });
      setCur(r.data.role); setMsg("Zapisano. Nowa rola działa od następnego wejścia tej osoby do panelu.");
      onChange?.();
    } catch (e) {
      setErr(e?.response?.data?.error || "Nie udało się zmienić roli.");
    }
    setBusy(false);
  };

  return (
    <section>
      <p className="technical text-[10px] gold-text mb-3 flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> ROLA KONTA</p>
      <div className="rounded-xl border hairline p-4 space-y-3">
        {self ? <p className="text-sm text-foreground/60">To Twoje konto — własnej roli nie można zmienić.</p>
          : locked ? <p className="text-sm text-foreground/60">Konto jest nieaktywne — rola nie może być tu zmieniona.</p> : null}
        <fieldset disabled={self || locked || busy} className="space-y-2">
          <legend className="sr-only">Rola konta</legend>
          {ROLES.map(([k, label, desc]) => (
            <label key={k} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${pick === k ? "border-[#C9A24A]/60 bg-[#C9A24A]/[0.06]" : "border-white/10"}`}>
              <input type="radio" name={`rola-${email}`} value={k} checked={pick === k} onChange={() => { setPick(k); setSure(false); }} className="mt-1 accent-[#C9A24A]" />
              <span><span className="block text-sm font-medium">{label}{cur === k ? " · obecna" : ""}</span><span className="block text-xs text-foreground/55">{desc}</span></span>
            </label>
          ))}
        </fieldset>
        {!self && !locked && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={busy || pick === cur}
              className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-md bg-[#C9A24A] text-[#0A0A0B] text-sm font-semibold disabled:opacity-40">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {sure ? `Potwierdź: ${ROLES.find(([k]) => k === pick)?.[1]}` : "Zapisz rolę"}
            </button>
            {sure && <button type="button" onClick={() => setSure(false)} className="text-sm text-foreground/60 underline underline-offset-4">Anuluj</button>}
            {msg && <span className="text-sm text-[#9FD0AA]" role="status">{msg}</span>}
            {err && <span className="text-sm text-[#E8C547]" role="alert">{err}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
