import React, { useEffect, useState } from "react";
import { logAccess } from "@/lib/auditLog";
import { X, Download, Send, Bell, Video, ArrowUpCircle, UserMinus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import useMailStatus, { MAIL_REQUIRED } from "@/lib/useMailStatus";
import SourcesReport from "./SourcesReport";

const STATUS_STYLE = {
  Zapisany: "text-[#C9A24A]",
  Obecny: "text-[#8FBF7F]",
  "Lista rezerwowa": "text-foreground/50",
  Wypisany: "blood-text line-through",
};

// Uczestnicy wydarzenia: pytania do Dawida, obecność, eksport CSV, wysyłka wiadomości.
export default function ParticipantsPanel({ event, onClose }) {
  const [parts, setParts] = useState(null);
  const { ready: mailOk } = useMailStatus();
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentInfo, setSentInfo] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    base44.functions
      .invoke("eventsAdmin", { action: "get", id: event.id })
      .then((res) => setParts(res.data.participants))
      .catch(() => setParts([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const markPresent = async (id, status) => {
    await base44.functions.invoke("eventsAdmin", {
      action: "present",
      id,
      status: status === "Obecny" ? "Zapisany" : "Obecny",
    });
    load();
  };

  const runAction = async (action, label) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("eventsAdmin", { action, id: event.id });
      if (action === "promote") {
        setSentInfo(res.data.promoted ? `Na miejsce awansował/a: ${res.data.promoted}.` : "Lista rezerwowa jest pusta.");
      } else if (action === "remindNow") {
        setSentInfo(`Przypomnienie wysłane do ${res.data.sent} z ${res.data.total} osób.`);
      } else if (action === "sendRecording") {
        setSentInfo(`Nagranie wysłane do ${res.data.sent} z ${res.data.total} osób.`);
      }
      load();
    } catch (err) {
      setError(err?.response?.data?.error || `Nie udało się: ${label}`);
    } finally {
      setBusy(false);
    }
  };

  const removeParticipant = async (id) => {
    if (!window.confirm("Usunąć dane tego uczestnika (imię, e-mail, pytanie)?")) return;
    await base44.functions.invoke("eventsAdmin", { action: "deleteParticipant", id });
    load();
  };

  const exportCsv = () => {
    logAccess("eksport", `Zapisy na spotkanie: ${event.title || event.slug} (CSV)`);
    const rows = [["Imię", "E-mail", "Status", "Pytanie do mnie", "Źródło", "Zapisano"].join(";")];
    for (const p of parts) {
      rows.push(
        [
          p.first_name,
          p.email,
          p.status,
          (p.question_for_dawid || "").replace(/[\r\n;]+/g, " "),
          p.source || "",
          new Date(p.created_at).toLocaleString("pl-PL"),
        ].join(";")
      );
    }
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `uczestnicy-${event.slug || event.id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const broadcast = async (e) => {
    e.preventDefault();
    if (sending || !subject || !text) return;
    setSending(true);
    setError("");
    setSentInfo(null);
    try {
      const res = await base44.functions.invoke("eventsAdmin", {
        action: "broadcast",
        id: event.id,
        subject,
        text,
      });
      setSentInfo(`Wysłano ${res.data.sent} z ${res.data.total} wiadomości.`);
      setSubject("");
      setText("");
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się wysłać wiadomości.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0D0D0E] border hairline p-6 md:p-10 my-8">
        <button onClick={onClose} className="absolute top-5 right-5 text-foreground/50 hover:text-foreground transition-colors" aria-label="Zamknij">
          <X className="h-5 w-5" />
        </button>

        <p className="technical text-[10px] gold-text mb-2">UCZESTNICY</p>
        <h3 className="shop-heading text-2xl text-[#F5EFE1] mb-8 pr-8">{event.title}</h3>

        {parts === null ? (
          <div className="h-40 border hairline animate-pulse" />
        ) : parts.length === 0 ? (
          <p className="text-foreground/50 border hairline p-6 text-center">Nikt jeszcze się nie zapisał.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <p className="technical text-[10px] text-foreground/50">
                ZAPISANI <span className="gold-text">{parts.filter((p) => p.status !== "Wypisany" && p.status !== "Lista rezerwowa").length}</span>
                {parts.some((p) => p.status === "Lista rezerwowa") && (
                  <> · REZERWA <span className="gold-text">{parts.filter((p) => p.status === "Lista rezerwowa").length}</span></>
                )}
              </p>
              {parts.some((p) => p.status === "Lista rezerwowa") && (
                <button
                  onClick={() => runAction("promote", "awans z listy rezerwowej")}
                  disabled={busy}
                  className="btn-ghost !px-3 !py-2 disabled:opacity-50"
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" /> PRZENIEŚ Z LISTY REZERWOWEJ
                </button>
              )}
              <button onClick={() => runAction("remindNow", "przypomnienie")} disabled={busy || !mailOk} title={mailOk ? undefined : MAIL_REQUIRED} className="btn-ghost !px-3 !py-2 disabled:opacity-50">
                <Bell className="h-3.5 w-3.5" /> WYŚLIJ PRZYPOMNIENIE TERAZ
              </button>
              <button onClick={() => runAction("sendRecording", "wysyłka nagrania")} disabled={busy || !mailOk} title={mailOk ? undefined : MAIL_REQUIRED} className="btn-ghost !px-3 !py-2 disabled:opacity-50">
                <Video className="h-3.5 w-3.5" /> WYŚLIJ NAGRANIE ZAPISANYM
              </button>
              <button onClick={exportCsv} className="btn-ghost !px-4 !py-2 ml-auto">
                <Download className="h-3.5 w-3.5" /> EKSPORT CSV
              </button>
            </div>
            {sentInfo && <p className="technical text-[10px] gold-text mb-4">{sentInfo}</p>}
            <SourcesReport event={event} parts={parts} />
            <ul className="border hairline divide-y hairline">
              {parts.map((p) => (
                <li key={p.id} className="p-5 flex flex-col md:flex-row md:items-start gap-4">
                  <div className="md:w-56 flex-shrink-0">
                    <p className="text-[#F5EFE1]">{p.first_name}</p>
                    <p className="text-xs text-foreground/40">{p.email}</p>
                    <span className={`technical text-[9px] ${STATUS_STYLE[p.status] || ""}`}>
                      {p.status.toUpperCase()}
                    </span>
                    {p.mail_unsent && <span className="block technical text-[9px] blood-text mt-1">MAIL NIEWYSŁANY</span>}
                    {p.joined_at && <span className="block technical text-[9px] text-[#8FBF7F] mt-1">WSZEDŁ/WESZŁA {new Date(p.joined_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                  <div className="flex-1">
                    {p.question_for_dawid ? (
                      <p className="text-sm gold-text leading-relaxed whitespace-pre-line">„{p.question_for_dawid}”</p>
                    ) : (
                      <p className="text-xs text-foreground/30">— bez pytania —</p>
                    )}
                    {p.source && <p className="technical text-[8px] text-foreground/30 mt-2">SRC: {p.source.toUpperCase()}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <button
                      onClick={() => markPresent(p.id, p.status)}
                      className={`btn-ghost !px-3 !py-1.5 ${
                        p.status === "Obecny" ? "!border-[#8FBF7F]/50 !text-[#8FBF7F]" : ""
                      }`}
                    >
                      {p.status === "Obecny" ? "OBECNY ✓" : "OZNACZ OBECNY"}
                    </button>
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="btn-ghost !px-3 !py-1.5 hover:!border-[#BC1E22] hover:!text-[#BC1E22]"
                      title="Usuń dane uczestnika"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <form onSubmit={broadcast} className="mt-10 pt-8 border-t hairline space-y-4">
          <p className="technical text-[10px] text-foreground/40">WYŚLIJ WIADOMOŚĆ DO ZAPISANYM</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Temat (np. zmiana godziny)"
            className="w-full bg-transparent border hairline px-4 py-3 text-foreground text-sm placeholder:text-foreground/30 focus:border-[#C9A24A] focus:outline-none transition-colors"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Treść wiadomości"
            className="w-full bg-transparent border hairline px-4 py-3 text-foreground text-sm placeholder:text-foreground/30 focus:border-[#C9A24A] focus:outline-none transition-colors resize-y"
          />
          {sentInfo && <p className="technical text-[10px] gold-text">{sentInfo}</p>}
          {error && <p className="technical text-[10px] blood-text">{error}</p>}
          {!mailOk && <p className="technical text-[10px] text-foreground/40">{MAIL_REQUIRED.toUpperCase()}</p>}
          <button type="submit" disabled={sending || !subject || !text || !mailOk} className="btn-relic !px-5 !py-3 disabled:opacity-50">
            <Send className="h-4 w-4" /> {sending ? "WYSYŁAM..." : "WYŚLIJ"}
          </button>
        </form>
      </div>
    </div>
  );
}