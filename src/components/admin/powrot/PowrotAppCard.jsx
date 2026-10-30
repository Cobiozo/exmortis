import React from "react";
import { X, Send, Loader2, AlertTriangle, Trash2 } from "lucide-react";

// Karta jednego zgłoszenia POWRÓT: dane z etapu 1, odpowiedzi ankiety, wysyłka linku.
export const surveyState = (a) => {
  if (a.survey_done_at) return { key: "done", label: `wypełniono ${new Date(a.survey_done_at).toLocaleDateString("pl-PL")}` };
  if (a.survey_sent_at) {
    const left = a.survey_expires_at ? new Date(a.survey_expires_at).getTime() - Date.now() : 0;
    return left > 0
      ? { key: "sent", label: `wysłano ${new Date(a.survey_sent_at).toLocaleDateString("pl-PL")} · ważne do ${new Date(a.survey_expires_at).toLocaleDateString("pl-PL")}` }
      : { key: "expired", label: `wygasło ${a.survey_expires_at ? new Date(a.survey_expires_at).toLocaleDateString("pl-PL") : ""}` };
  }
  return { key: "none", label: "nie wysłano" };
};

const Line = ({ label, value }) => (
  <div>
    <p className="technical text-[10px] gold-text mb-1">{label}</p>
    <p className="text-sm text-foreground/75 whitespace-pre-line leading-relaxed">{value || "—"}</p>
  </div>
);

export default function PowrotAppCard({ a, onClose, onSend, sending, error, notice, onDelete }) {
  const st = surveyState(a);
  const lists = (v) => (Array.isArray(v) && v.length ? v.join(", ") : "—");
  return (
    <div className="border border-[#C9A24A]/40 p-6 space-y-5 bg-[#0A0A0B]">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {a.pilne && <span className="inline-block bg-[#BC1E22] text-[#F5EFE1] technical text-[10px] px-2 py-1 mb-2">SPRAWDŹ PILNIE</span>}
          <p className="shop-heading text-2xl text-[#F5EFE1]">{a.full_name}</p>
          <p className="text-xs text-foreground/50">
            {a.email}{a.phone ? ` · ${a.phone}` : ""} · {new Date(a.created_date).toLocaleString("pl-PL")}
          </p>
        </div>
        <button onClick={onClose} aria-label="Zamknij"><X className="h-5 w-5 text-foreground/50" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-y hairline py-4">
        <div>
          <p className="technical text-[10px] text-foreground/45 mb-1">PEŁNA ANKIETA</p>
          <p className={`text-sm ${st.key === "done" ? "gold-text" : st.key === "expired" ? "blood-text" : "text-foreground/70"}`}>{st.label}</p>
        </div>
        <button
          onClick={onSend}
          disabled={sending || st.key === "done"}
          className="btn-ghost !py-2 !px-4 text-[10px] ml-auto disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {st.key === "none" ? "WYŚLIJ PEŁNĄ ANKIETĘ" : "WYŚLIJ PONOWNIE"}
        </button>
      </div>
      {notice && <p className="text-xs gold-text">{notice}</p>}
      {error && <p className="text-xs blood-text flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />{error}</p>}

      <div className="grid md:grid-cols-2 gap-5">
        <Line label="ETAP 1 · CO JEST WAŻNE TERAZ" value={a.situation} />
        <Line label="CEL" value={a.goal} />
        <Line label="Z CZEGO WRAŻA" value={lists(a.return_from) + (a.return_from_other ? ` — ${a.return_from_other}` : "")} />
        <Line label="OD JAK DAWNA" value={a.duration} />
        <Line label="OBSZARY" value={lists(a.affected_areas)} />
        <Line label="PRÓBY WYJŚCIA" value={a.tried_before} />
        <Line label="WSPARCIE TERAPEUTY" value={a.therapy_support} />
        <Line label="PRZESZKODA" value={a.obstacle} />
        <Line label="GOTOWOŚĆ (1–10)" value={a.readiness != null ? String(a.readiness) : ""} />
        <Line label="CZAS TYGODNIOWO" value={a.weekly_time} />
        <Line label="FORMA PRACY" value={a.work_form} />
        <Line label="INWESTYCJA" value={a.investment} />
        <Line label="WIEK" value={a.age} />
        <Line label="SKĄD WIE" value={a.source} />
        <Line label="PREFEROWANY KONTAKT" value={a.contact_pref} />
        <Line label="DODATKOWE" value={a.anything_else} />
      </div>

      <div className="text-xs text-foreground/50 space-y-1 border-t hairline pt-4">
        <p>Zgody: kontakt/RODO {a.consent_rodo ? "✓" : "—"} · pełnoletność · płatność {a.consent_paid ? "✓" : "—"} · dane o zdrowiu {a.consent_health ? "✓" : "—"}</p>
        {a.wspolpraca_od && <p>Współpraca od {new Date(a.wspolpraca_od).toLocaleDateString("pl-PL")}</p>}
      </div>

      <div className="flex justify-end">
        <button onClick={onDelete} className="btn-blood !py-2 !px-4 text-[10px]">
          <Trash2 className="h-3.5 w-3.5" /> USUŃ ZGŁOSZENIE
        </button>
      </div>
    </div>
  );
}