import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import SettingsCard, { FOCUS } from "./SettingsCard";
import { notif, refreshNotif } from "@/components/exmortis/nav/notifApi";

// Ustawienia → Powiadomienia (dzwoneczek). Tylko na stronie — bez e-maili.
const ROWS = [
  ["nowosci", "Nowości", "Nowe materiały i zapowiedzi w Skarbcu, nowe historie w ROZDROŻACH."],
  ["promocje", "Promocje i kody rabatowe", "Przedsprzedaże, obniżki i kody, które udostępniam wszystkim."],
  ["spotkania", "Nowe spotkania", "Webinary i wieczory, na które możesz się zapisać."],
];

export default function NotificationsCard() {
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { notif("feed").then((d) => setPrefs(d.prefs || {})).catch(() => setErr("Nie udało się wczytać ustawień powiadomień.")); }, []);
  useEffect(() => {
    if (prefs && window.location.hash === "#powiadomienia") document.getElementById("powiadomienia")?.scrollIntoView({ block: "start" });
  }, [prefs]);

  const toggle = async (k) => {
    const next = { ...prefs, [k]: prefs[k] === false };
    setBusy(k); setErr("");
    try { const d = await notif("prefs", { prefs: next }); setPrefs(d.prefs); refreshNotif(); }
    catch { setErr("Nie udało się zapisać. Spróbuj ponownie."); }
    setBusy("");
  };

  return (
    <div id="powiadomienia" className="scroll-mt-28">
      <SettingsCard title="Powiadomienia">
        {!prefs && !err ? <Loader2 className="h-5 w-5 animate-spin text-[#C9A24A]" aria-label="Wczytywanie" /> : prefs && (
          <div className="divide-y divide-[#3D3D3F]/60">
            {ROWS.map(([k, t, d]) => {
              const on = prefs[k] !== false;
              return (
                <button key={k} type="button" role="switch" aria-checked={on} onClick={() => toggle(k)} disabled={!!busy}
                  className={`w-full flex items-center gap-4 min-h-[56px] py-3 text-left group ${FOCUS}`}>
                  <span className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${on ? "bg-[#C9A24A]" : "bg-[#5A5A5C]"}`}>
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-[#0A0A0B] transition-all ${on ? "left-6" : "left-1"}`} />
                  </span>
                  <span className="flex-1">
                    <span className="block group-hover:text-[#C9A24A] transition-colors">{t}</span>
                    <span className="block text-xs text-[#E2E2E2]/60 mt-0.5">{d}</span>
                  </span>
                  {busy === k && <Loader2 className="h-4 w-4 animate-spin" />}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-sm text-[#E2E2E2]/70 mt-3">Sprawy Twojego konta (spotkania, na które się zapisano, nagrania, kończący się dostęp, wiadomości) i moje ogłoszenia widzisz zawsze. Powiadomienia są tylko na stronie, pod dzwoneczkiem — nie wysyłam przez nie maili.</p>
        {err && <p role="alert" className="text-sm text-[#E8C547] mt-3">{err}</p>}
      </SettingsCard>
    </div>
  );
}
