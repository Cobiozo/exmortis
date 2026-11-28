import React, { useEffect, useState } from "react";
import { X, Send, Loader2, AlertTriangle, Trash2, CalendarPlus, Mail, Eye, Clock, Save, KeyRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PowrotPayBox from "./PowrotPayBox";
import { STATUS_LABEL, TEMPLATES, INVITE_INTRO } from "./powrotTemplates";
import { POWROT } from "@/lib/powrotOffer";
import { confirmDialog } from "@/components/admin/ui/confirmDialog";

// Karta osoby w panelu „Kandydaci i uczestnicy POWRÓT” (v2, 18.11.2026):
// status z historią, akcje z podglądem wiadomości, odpowiedzi, notatka, czas obsługi,
// a po przyjęciu — notatki z sesji i wiadomości z „Mojego konta”.
const call = (p) => base44.functions.invoke("adminPowrot", p).then((r) => r.data);
const dt = (v) => (v ? new Date(v).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "");
const dd = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "");
const ETAPY = [["", "—"], ["smierc", "Śmierć"], ["prog", "Próg"], ["powrot", "Powrót"], ["inny", "Inny"]];
const inp = "w-full bg-transparent border hairline rounded-lg px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none";

export const surveyState = (a) => {
  if (a.survey_done_at) return { key: "done", label: `wypełniono ${dd(a.survey_done_at)}` };
  if (a.survey_sent_at) {
    const left = a.survey_expires_at ? new Date(a.survey_expires_at).getTime() - Date.now() : 0;
    return left > 0
      ? { key: "sent", label: `wysłano ${dd(a.survey_sent_at)} · ważne do ${dd(a.survey_expires_at)}` }
      : { key: "expired", label: `wygasło ${dd(a.survey_expires_at)}` };
  }
  return { key: "none", label: "nie wysłano" };
};

const Line = ({ label, value }) => (
  <div>
    <p className="technical text-[10px] gold-text mb-1">{label}</p>
    <p className="text-sm text-foreground/75 whitespace-pre-line leading-relaxed">{value || "—"}</p>
  </div>
);
const Box = ({ title, children, right }) => (
  <div className="border hairline rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-3"><p className="technical text-[10px] text-foreground/55">{title}</p><div className="ml-auto">{right}</div></div>
    {children}
  </div>
);

function Composer({ a, onDone, onCancel, initialKey }) {
  const [key, setKey] = useState(initialKey);
  const tpl = key === "invite" ? null : TEMPLATES.find((t) => t.key === key);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (key === "invite") { setSubject("Zaproszenie na rozmowę wstępną — program POWRÓT"); setBody(INVITE_INTRO(a)); return; }
    const m = tpl?.make(a); if (m) { setSubject(m.subject); setBody(m.body); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    if (body.includes("[wpisz")) { setErr("Uzupełnij fragmenty w nawiasach kwadratowych."); return; }
    if (!(await confirmDialog(`Wysłać wiadomość do ${a.full_name} (${a.email})?`))) return;
    setBusy(true); setErr("");
    try {
      const r = key === "invite" ? await call({ action: "invite", id: a.id, body }) : await call({ action: "mail", id: a.id, template: key, subject, body });
      onDone(r?.mail === "wyslany" ? "Wysłane." : "Wiadomość czeka w kolejce wysyłki.");
    } catch (e) { setErr(e?.response?.data?.error || "Nie udało się wysłać."); } finally { setBusy(false); }
  };
  return (
    <Box title="WIADOMOŚĆ — PODGLĄD PRZED WYSŁANIEM" right={<button onClick={onCancel} aria-label="Zamknij podgląd"><X className="h-4 w-4 text-foreground/50" /></button>}>
      <select value={key} onChange={(e) => setKey(e.target.value)} className={inp}>
        <option value="invite">Zaproszenie na rozmowę wstępną (link do kalendarza)</option>
        {TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      {key !== "invite" && <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inp} aria-label="Temat" />}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={inp} aria-label="Treść" />
      {key === "invite" && <p className="text-xs text-foreground/50">Pod treścią dodam przycisk „Wybierz termin” (osobisty link, ważny 7 dni, rozmowa 20 minut) i podpis.</p>}
      {err && <p className="text-xs blood-text">{err}</p>}
      <div className="flex justify-end"><button onClick={send} disabled={busy} className="btn-relic !py-2 !px-5 text-sm disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Wyślij</button></div>
    </Box>
  );
}

function SessionNotes({ a, notes, reload }) {
  const empty = { nr: (notes.at(-1)?.nr || 0) + 1, data: new Date().toISOString().slice(0, 10), etap: "", notatka: "", krok: "", materialy: "" };
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await call({ action: "session_note", id: a.id, note: edit }); setEdit(null); reload(); } finally { setBusy(false); } };
  const del = async (n) => { if (!(await confirmDialog(`Usunąć notatkę z sesji ${n.nr}? Tego nie da się cofnąć.`))) return; await call({ action: "session_note_delete", id: a.id, note_id: n.id }); reload(); };
  return (
    <Box title="NOTATKI Z SESJI · WIDZISZ JE TYLKO TY" right={!edit && <button onClick={() => setEdit(empty)} className="text-xs gold-text">+ Dodaj notatkę</button>}>
      {edit && (
        <div className="space-y-2 border hairline rounded-lg p-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-foreground/55">Sesja nr<input type="number" min={0} max={20} value={edit.nr} onChange={(e) => setEdit({ ...edit, nr: e.target.value })} className={inp} /></label>
            <label className="text-xs text-foreground/55">Data<input type="date" value={edit.data || ""} onChange={(e) => setEdit({ ...edit, data: e.target.value })} className={inp} /></label>
            <label className="text-xs text-foreground/55">Etap<select value={edit.etap || ""} onChange={(e) => setEdit({ ...edit, etap: e.target.value })} className={inp}>{ETAPY.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <label className="block text-xs text-foreground/55">Notatka<textarea rows={5} value={edit.notatka || ""} onChange={(e) => setEdit({ ...edit, notatka: e.target.value })} className={inp} /></label>
          <label className="block text-xs text-foreground/55">Ustalony krok do następnej sesji<textarea rows={2} value={edit.krok || ""} onChange={(e) => setEdit({ ...edit, krok: e.target.value })} className={inp} /></label>
          <label className="block text-xs text-foreground/55">Materiały udostępnione po sesji (przydzielasz je w Bibliotece)<input value={edit.materialy || ""} onChange={(e) => setEdit({ ...edit, materialy: e.target.value })} className={inp} /></label>
          <p className="text-[11px] text-foreground/45">Pisz tak, żeby notatkę można było udostępnić uczestnikowi na jego żądanie (prawo dostępu do danych). Usuwana 12 miesięcy po zakończeniu współpracy.</p>
          <div className="flex justify-end gap-3"><button onClick={() => setEdit(null)} className="text-xs text-foreground/55">Anuluj</button><button onClick={save} disabled={busy} className="btn-ghost !py-1.5 !px-4 text-xs"><Save className="h-3.5 w-3.5" /> Zapisz</button></div>
        </div>
      )}
      {!notes.length && !edit && <p className="text-sm text-foreground/45">Brak notatek.</p>}
      {notes.map((n) => (
        <div key={n.id} className="border-t hairline pt-3">
          <div className="flex items-center gap-3 text-xs text-foreground/55">
            <span className="gold-text">Sesja {n.nr}</span><span>{dd(n.data)}</span>{n.etap && <span>{ETAPY.find((e) => e[0] === n.etap)?.[1]}</span>}
            <button onClick={() => setEdit({ ...n, data: n.data ? String(n.data).slice(0, 10) : "" })} className="ml-auto gold-text">Edytuj</button>
            <button onClick={() => del(n)} className="text-foreground/40 hover:text-[#BC1E22]" aria-label="Usuń notatkę"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {n.notatka && <p className="text-sm text-foreground/75 whitespace-pre-line mt-1">{n.notatka}</p>}
          {n.krok && <p className="text-xs text-foreground/60 mt-1">Krok: {n.krok}</p>}
          {n.materialy && <p className="text-xs text-foreground/60 mt-1">Materiały: {n.materialy}</p>}
        </div>
      ))}
    </Box>
  );
}

function Messages({ a, messages, reload }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const reply = async () => { if (!text.trim()) return; setBusy(true); try { await call({ action: "msg_reply", id: a.id, tresc: text }); setText(""); reload(); } finally { setBusy(false); } };
  return (
    <Box title="WIADOMOŚCI W MOIM KONCIE · ODPOWIEDŹ DO 48 H W DNI ROBOCZE">
      <div className="max-h-72 overflow-y-auto space-y-2">
        {!messages.length && <p className="text-sm text-foreground/45">Brak wiadomości.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-lg p-3 text-sm whitespace-pre-line ${m.kierunek === "mentor" ? "bg-[#C9A24A]/10 ml-8" : "bg-[#151517] mr-8"}`}>
            <p className="text-[11px] text-foreground/45 mb-1">{m.kierunek === "mentor" ? "Ty" : a.full_name} · {dt(m.created_at)}{m.kierunek === "uczestnik" && !m.read_at ? " · nowa" : ""}</p>
            {m.tresc}
          </div>
        ))}
      </div>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inp} placeholder="Odpowiedź (uczestnik dostanie e-mail bez treści, że czeka wiadomość)" />
      <div className="flex justify-end"><button onClick={reply} disabled={busy || !text.trim()} className="btn-ghost !py-1.5 !px-4 text-xs disabled:opacity-40"><Send className="h-3.5 w-3.5" /> Odpowiedz</button></div>
    </Box>
  );
}

export default function PowrotAppCard({ a, onClose, onDelete, onReload }) {
  const [detail, setDetail] = useState(null);
  const [compose, setCompose] = useState(null);
  const [health, setHealth] = useState(null);
  const [note, setNote] = useState(a.notatka || "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const st = surveyState(a);
  const participant = ["w_programie", "wstrzymany", "zakonczony"].includes(a.status);
  const lists = (v) => (Array.isArray(v) && v.length ? v.join(", ") : "");

  const loadDetail = () => call({ action: "detail", id: a.id }).then(setDetail).catch(() => setDetail({ log: [], notes: [], messages: [] }));
  useEffect(() => { loadDetail(); }, [a.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = (msg) => { setNotice(msg); setError(""); setCompose(null); onReload?.(); loadDetail(); };
  const run = async (key, payload, msg, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key); setError(""); setNotice("");
    try { const r = await call({ id: a.id, ...payload }); after(typeof msg === "function" ? msg(r) : msg); }
    catch (e) { setError(e?.response?.data?.error || "Nie udało się."); }
    finally { setBusy(""); }
  };

  return (
    <div className="border border-[#C9A24A]/40 rounded-2xl p-5 md:p-6 space-y-5 bg-[#0A0A0B]">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {a.pilne && <span className="inline-block bg-[#BC1E22] text-[#F5EFE1] technical text-[10px] px-2 py-1 mb-2 rounded">SPRAWDŹ PILNIE</span>}
          <p className="shop-heading text-2xl text-[#F5EFE1]">{a.full_name}</p>
          <p className="text-xs text-foreground/50 break-all">{a.email}{a.phone ? ` · ${a.phone}` : ""} · zgłoszenie {dt(a.created_date)}</p>
        </div>
        <button onClick={onClose} aria-label="Zamknij"><X className="h-5 w-5 text-foreground/50" /></button>
      </div>

      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end border-y hairline py-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div><p className="technical text-[10px] text-foreground/45 mb-1">STATUS</p>
            <select value={a.status || "nowe"} onChange={(e) => run("status", { action: "status", status: e.target.value }, "Status zmieniony.", `Zmienić status na „${STATUS_LABEL[e.target.value]}”? Nic nie zostanie wysłane.`)} className={inp + " !w-auto"}>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
          <div><p className="technical text-[10px] text-foreground/45 mb-1">ANKIETA</p><p className={st.key === "done" ? "gold-text" : st.key === "expired" ? "blood-text" : "text-foreground/70"}>{st.label}</p></div>
          {a.invite_sent_at && <div><p className="technical text-[10px] text-foreground/45 mb-1">ROZMOWA WSTĘPNA</p><p className="text-foreground/70">{detail?.booking ? `${dt(detail.booking.starts_at)} · ${detail.booking.status === "POTWIERDZONA" ? "potwierdzona" : detail.booking.status.toLowerCase()}` : `zaproszenie ${dd(a.invite_sent_at)}, ważne do ${dd(a.invite_expires_at)}`}</p></div>}
          <div><p className="technical text-[10px] text-foreground/45 mb-1">CZAS OBSŁUGI</p><p className="text-foreground/70">{a.czas_min || 0} min</p></div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {!a.survey_done_at && <button onClick={() => run("survey", { action: "survey" }, (r) => (r?.mail === "wyslany" ? "Ankieta wysłana." : "Ankieta czeka w kolejce wysyłki."), `Wysłać ankietę do ${a.full_name}?`)} disabled={!!busy} className="btn-ghost !py-2 !px-3 text-xs">{busy === "survey" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {st.key === "none" ? "Wyślij ankietę" : "Wyślij ankietę ponownie"}</button>}
          <button onClick={() => setCompose("invite")} className="btn-ghost !py-2 !px-3 text-xs"><CalendarPlus className="h-3.5 w-3.5" /> Zaproś na rozmowę</button>
          <button onClick={() => setCompose("info")} className="btn-ghost !py-2 !px-3 text-xs"><Mail className="h-3.5 w-3.5" /> Wiadomość z szablonu</button>
        </div>
      </div>
      {notice && <p className="text-xs gold-text" role="status">{notice}</p>}
      {error && <p className="text-xs blood-text flex items-center gap-2" role="alert"><AlertTriangle className="h-3.5 w-3.5" />{error}</p>}
      {compose && <Composer a={a} initialKey={compose} onCancel={() => setCompose(null)} onDone={after} />}

      <PowrotPayBox a={a} onDone={() => { onReload?.(); loadDetail(); }} />
      {(a.paid_at || a.status === "oferta" || participant) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/55">
          <KeyRound className="h-3.5 w-3.5 gold-text" />
          <span>Po płatności: nadaj dostęp do rezerwacji 8 sesji (ważny {POWROT.validMonths} miesięcy) i wyślij powitanie.</span>
          <button onClick={() => run("grant", { action: "grant", force: !a.paid_at }, "Dostęp do 8 sesji nadany.", a.paid_at ? "Nadać dostęp do 8 sesji POWRÓT?" : "Płatność nie jest potwierdzona. Mimo to nadać dostęp do 8 sesji?")} disabled={!!busy} className="btn-ghost !py-1.5 !px-3 text-xs">Nadaj dostęp do sesji</button>
          <button onClick={() => setCompose("powitanie")} className="text-xs gold-text">Powitanie</button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        <Line label="CO SPRAWIA, ŻE TERAZ" value={a.situation} />
        <Line label="ZMIANA W 6 MIESIĘCY" value={a.goal} />
        <Line label="OBSZAR" value={lists(a.return_from) + (a.return_from_other ? ` — ${a.return_from_other}` : "")} />
        <Line label="OD JAK DAWNA" value={a.duration} />
        <Line label="OCZEKIWANIA" value={lists(a.oczekiwania)} />
        <Line label="CO JUŻ ZROBIONO" value={a.tried_before} />
        <Line label="KIEDY START" value={a.start_kiedy} />
        <Line label="CZAS MIĘDZY SESJAMI" value={a.weekly_time} />
        <Line label="KOSZT" value={a.investment} />
        <Line label="DECYZJA WŁASNA" value={a.decyzja} />
        <Line label="DODATKOWE" value={a.anything_else} />
        <Line label="WIEK · ŹRÓDŁO · KONTAKT" value={[a.age, a.source, a.contact_pref].filter(Boolean).join(" · ")} />
        {(a.readiness != null || a.obstacle || lists(a.affected_areas)) && <Line label="DAWNA ANKIETA" value={[a.readiness != null ? `gotowość ${a.readiness}/10` : "", a.obstacle, lists(a.affected_areas)].filter(Boolean).join("\n")} />}
      </div>

      <Box title="CZĘŚĆ O ZDROWIU (ZA OSOBNĄ ZGODĄ)">
        {!a.consent_health && !a.has_health && <p className="text-sm text-foreground/45">Brak zgody — ta część nie została wypełniona.</p>}
        {(a.consent_health || a.has_health) && !health && <button onClick={() => call({ action: "health", id: a.id }).then(setHealth).then(loadDetail)} className="btn-ghost !py-1.5 !px-3 text-xs"><Eye className="h-3.5 w-3.5" /> Pokaż (zapisze się w historii)</button>}
        {health && <div className="grid md:grid-cols-2 gap-4"><Line label="WSPARCIE SPECJALISTY" value={health.therapy_support} /><Line label="UWAGI O ZDROWIU" value={health.zdrowie_uwagi} /></div>}
      </Box>

      <div className="grid md:grid-cols-2 gap-4">
        <Box title="NOTATKA ADMINISTRACYJNA" right={<button onClick={() => run("note", { action: "note", notatka: note }, "Notatka zapisana.")} className="text-xs gold-text">Zapisz</button>}>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="Krótka notatka robocza" />
        </Box>
        <Box title="CZAS POŚWIĘCONY KANDYDATOWI">
          <div className="flex flex-wrap gap-2">
            {[10, 20, 30, 60].map((m) => <button key={m} onClick={() => run("time", { action: "time", minutes: m }, `Dodano ${m} min.`)} className="btn-ghost !py-1.5 !px-3 text-xs"><Clock className="h-3.5 w-3.5" /> +{m} min</button>)}
          </div>
          <p className="text-[11px] text-foreground/45">Służy do wskaźnika „czas obsługi na jednego przyjętego uczestnika”.</p>
        </Box>
      </div>

      {participant && detail && <SessionNotes a={a} notes={detail.notes || []} reload={loadDetail} />}
      {participant && detail && <Messages a={a} messages={detail.messages || []} reload={() => { loadDetail(); onReload?.(); }} />}

      <Box title="HISTORIA (TYLKO DO DOPISYWANIA)">
        <div className="max-h-56 overflow-y-auto space-y-1 text-xs text-foreground/60">
          {(detail?.log || []).map((l, i) => (
            <p key={i}><span className="text-foreground/40">{dt(l.at)}</span> · {l.to_status ? `${STATUS_LABEL[l.from_status] ? STATUS_LABEL[l.from_status] + " → " : ""}${STATUS_LABEL[l.to_status] || l.to_status} · ` : ""}{l.summary}{l.actor && l.actor !== "system" ? ` · ${l.actor}` : ""}</p>
          ))}
          {detail && !detail.log?.length && <p>Brak wpisów.</p>}
        </div>
      </Box>

      <div className="text-xs text-foreground/50 border-t hairline pt-4 flex flex-wrap items-center gap-3">
        <span>Potwierdzenia: cena i zasady {a.consent_paid ? "✓" : "—"} · zdrowie {a.consent_health ? "✓" : "—"}{a.wspolpraca_od ? ` · współpraca od ${dd(a.wspolpraca_od)}` : ""}{a.wspolpraca_do ? ` do ${dd(a.wspolpraca_do)}` : ""}</span>
        <button onClick={onDelete} className="ml-auto btn-blood !py-2 !px-4 text-xs"><Trash2 className="h-3.5 w-3.5" /> Usuń zgłoszenie</button>
      </div>
    </div>
  );
}
