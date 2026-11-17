import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { POWROT, POWROT_CONTACT } from "@/lib/powrotOffer";

// Moje konto → „Mój POWRÓT” (18.11.2026): postęp sesji, zasady współpracy, materiały i wiadomości z mentorem.
// Dane przychodzą z funkcji powrotUczestnik (tylko własny udział; bez ankiety i notatek mentora).
const STATUS = { w_programie: "W programie", wstrzymany: "Program wstrzymany", zakonczony: "Program zakończony · absolwent" };
const dt = (v) => (v ? new Date(v).toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" }) : "");
const card = "border hairline rounded-2xl p-5 md:p-6 bg-[#0D0D0E]";

export default function MyPowrot({ data, onChange, go }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  if (!data?.participant) return null;
  const s = data.sessions;
  const done = s ? Math.min(POWROT.sessions, s.odbyte ?? s.sessions_used ?? 0) : 0;
  const active = data.status === "w_programie";

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setErr(""); setOk("");
    try {
      const r = await base44.functions.invoke("powrotUczestnik", { action: "send", tresc: text });
      onChange?.(r.data); setText(""); setOk("Wysłane. Odpowiem w ciągu 48 godzin w dni robocze.");
    } catch (e2) { setErr(e2?.response?.data?.error || "Nie udało się wysłać wiadomości."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className={card}>
        <p className="technical text-[10px] gold-text mb-2">{STATUS[data.status] || "POWRÓT"}</p>
        <h3 className="shop-heading text-2xl text-[#F5EFE1] mb-3">{data.first_name ? `${data.first_name}, to Twoja przestrzeń w programie.` : "Twoja przestrzeń w programie."}</h3>
        {s ? (
          <>
            <p className="text-foreground/75">Sesja {Math.min(done + (active ? 1 : 0), POWROT.sessions)} z {POWROT.sessions}{s.nastepna ? ` · najbliższa: ${dt(s.nastepna)}` : ""}</p>
            <div className="h-1.5 rounded-full bg-[#1d1d20] mt-3 overflow-hidden" aria-hidden="true"><div className="h-full bg-[#C9A24A]" style={{ width: `${(done / POWROT.sessions) * 100}%` }} /></div>
            <p className="text-xs text-foreground/50 mt-2">Odbyte sesje: {done}. Pakiet ważny do {new Date(s.valid_until).toLocaleDateString("pl-PL")}.</p>
          </>
        ) : (
          <p className="text-foreground/65">Dostęp do rezerwacji sesji pojawi się tu, gdy go nadam — zwykle tego samego dnia po płatności.</p>
        )}
        <div className="flex flex-wrap gap-3 mt-5">
          <button onClick={() => go("sesje")} className="btn-relic !min-h-[44px] !py-2 !px-5 text-sm">Umów sesję</button>
          <button onClick={() => go("biblioteka")} className="btn-ghost !min-h-[44px] !py-2 !px-5 text-sm">Dziennik i materiały</button>
        </div>
      </div>

      <div className={card}>
        <p className="technical text-[10px] gold-text mb-3">KONTAKT MIĘDZY SESJAMI</p>
        <ul className="space-y-2 text-sm text-foreground/75 leading-relaxed list-disc pl-5">
          {POWROT_CONTACT.lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p className="text-xs text-foreground/50 mt-3">Sesję możesz bezpłatnie przełożyć najpóźniej 24 godziny przed jej rozpoczęciem. Pełne zasady: <Link to="/umowa-powrot" className="gold-text underline">Umowa POWRÓT</Link>.</p>
      </div>

      <div className={card}>
        <div className="flex items-center gap-3 mb-3">
          <p className="technical text-[10px] gold-text">WIADOMOŚCI</p>
          {active && <p className="ml-auto text-xs text-foreground/50">W tym tygodniu możesz wysłać jeszcze: {data.written_left}</p>}
        </div>
        {active && (
          <form onSubmit={send} className="space-y-3 mb-5">
            <label htmlFor="powrot-msg" className="sr-only">Wiadomość do Dawida</label>
            <textarea id="powrot-msg" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} disabled={data.written_left <= 0}
              className="w-full bg-transparent border hairline rounded-xl px-4 py-3 text-sm focus:border-[#C9A24A] focus:outline-none disabled:opacity-50"
              placeholder={data.written_left > 0 ? "Napisz, co chcesz mi przekazać przed kolejną sesją." : "Limit wiadomości w tym tygodniu jest wykorzystany. Kolejne od poniedziałku."} />
            {err && <p className="text-sm blood-text" role="alert">{err}</p>}
            {ok && <p className="text-sm gold-text" role="status">{ok}</p>}
            <button type="submit" disabled={busy || !text.trim() || data.written_left <= 0} className="btn-ghost !min-h-[44px] !py-2 !px-5 text-sm disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Wyślij
            </button>
          </form>
        )}
        <div className="space-y-2">
          {!data.messages.length && <p className="text-sm text-foreground/50">Nie ma jeszcze wiadomości.</p>}
          {data.messages.map((m) => (
            <div key={m.id} className={`rounded-xl p-3 text-sm whitespace-pre-line ${m.kierunek === "mentor" ? "bg-[#C9A24A]/10" : "bg-[#151517]"}`}>
              <p className="text-[11px] text-foreground/45 mb-1">{m.kierunek === "mentor" ? "Dawid" : "Ty"} · {dt(m.created_at)}</p>
              {m.tresc}
            </div>
          ))}
        </div>
        <p className="text-xs text-foreground/45 mt-4">To nie jest kanał pomocy w nagłych sytuacjach. W kryzysie: 116 123, 800 70 2222, w zagrożeniu życia 112.</p>
      </div>
    </div>
  );
}
