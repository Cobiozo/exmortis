import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, X, Pencil, Send, Eye, Smartphone, Monitor, FlaskConical, CalendarClock } from "lucide-react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import useMailStatus, { MAIL_REQUIRED } from "@/lib/useMailStatus";

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";

const EMPTY = { id: null, subject: "", content: "", group_id: "", preheader: "", series_name: "", buttons: [{ label: "", url: "" }] };
// „exmortis.pl/test” → „https://exmortis.pl/test” (to samo robi serwer).
const fixUrl = (u) => {
  const v = String(u || "").trim();
  if (!v) return "";
  if (/^https:\/\//i.test(v)) return v;
  if (/^http:\/\//i.test(v)) return "https://" + v.slice(7);
  return /^[a-z]+:/i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
};
const fields = (e) => {
  const buttons = (e.buttons || []).filter((b) => b.label.trim() || b.url.trim()).map((b) => ({ label: b.label.trim(), url: fixUrl(b.url) }));
  // cta_label / cta_url — zgodność z wcześniejszą wersją funkcji na serwerze (jeden przycisk).
  return { subject: e.subject, content: e.content, preheader: e.preheader, buttons, series_name: e.series_name || "",
    cta_label: buttons[0]?.label || "", cta_url: buttons[0]?.url || "" };
};
// Prawdziwy komunikat z serwera (np. „Przycisk … nie ma linku”), a nie ogólny tekst.
const errText = (err, fallback) => err?.response?.data?.error || (err?.message && !/^Request failed|^Funkcja \w+: \d+$/.test(err.message) ? err.message : "") || fallback;
const MAX_BUTTONS = 3;

// Termin wysyłki: pole datetime-local pracuje w czasie przeglądarki (u administratora — czas polski).
const plWhen = (iso) => new Date(iso).toLocaleString("pl-PL", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
// Domyślnie: najbliższy poniedziałek, 8:00 (Listy powrotu wychodzą w poniedziałki rano).
const nextMonday7 = () => {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  const add = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + add);
  return toLocalInput(d.toISOString());
};
const STATUS = { sent: "WYSŁANA", scheduled: "ZAPLANOWANA", sending: "WYSYŁA SIĘ", draft: "SZKIC" };

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState([]);
  const { ready: mailOk } = useMailStatus();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [preview, setPreview] = useState(null); // { html, w }

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.functions.invoke("adminNewsletter", { action: "campaigns.list" }).then((r) => r.data.campaigns).catch(() => []),
      base44.functions.invoke("adminNewsletter", { action: "groups.list" }).then((r) => r.data.groups).catch(() => []),
    ])
      .then(([c, g]) => {
        setCampaigns(c);
        setGroups(g);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openEditor = async (c) => {
    setError("");
    setSending(null);
    setRemaining(null);
    setBusy(true);
    try {
      if (c) {
        const res = await base44.functions.invoke("adminNewsletter", { action: "campaigns.get", id: c.id });
        const camp = res.data.campaign;
        setEditor({
          id: camp.id,
          subject: camp.subject,
          content: camp.content || "",
          group_id: camp.group_id || "",
          preheader: camp.preheader || "",
          buttons: Array.isArray(camp.buttons) && camp.buttons.length
            ? camp.buttons.map((b) => ({ label: b.label || "", url: b.url || "" }))
            : [{ label: camp.cta_label || "", url: camp.cta_url || "" }],
          status: camp.status || "draft",
          series_name: camp.series_name || "",
          scheduled_at: camp.scheduled_at || null,
          when: camp.scheduled_at ? toLocalInput(camp.scheduled_at) : nextMonday7(),
        });
        setRemaining(res.data.remaining);
      } else {
        setEditor({ ...EMPTY, status: "draft", scheduled_at: null, when: nextMonday7() });
      }
    } catch (err) {
      setError(errText(err, "Nie udało się otworzyć kampanii."));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editor.subject.trim()) {
      setError("Podaj temat wiadomości.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await base44.functions.invoke("adminNewsletter", {
        action: "campaigns.save",
        id: editor.id,
        ...fields(editor),
        group_id: editor.group_id || null,
      });
      setEditor({ ...editor, id: res.data.id });
      setRemaining(res.data.remaining);
      load();
      return res.data.id;
    } catch (err) {
      setError(errText(err, "Nie udało się zapisać."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Zaplanuj: najpierw zapis treści (żeby wyszła dokładnie ta wersja), potem termin.
  const schedule = async () => {
    if (!editor.when) {
      setError("Wybierz datę i godzinę wysyłki.");
      return;
    }
    const at = new Date(editor.when);
    if (!window.confirm(`Zaplanować „${editor.subject.trim()}” na ${plWhen(at.toISOString())} do ${remaining ?? "wszystkich"} odbiorców?`)) return;
    setInfo("");
    const id = await save();
    if (!id) return;
    setBusy(true);
    try {
      const r = await base44.functions.invoke("adminNewsletter", { action: "campaigns.schedule", id, at: at.toISOString() });
      setEditor((e) => ({ ...e, id, status: "scheduled", scheduled_at: r.data.scheduled_at }));
      setInfo(`Zaplanowano na ${r.data.kiedy}. Do tego czasu możesz poprawiać treść (pamiętaj o „Zapisz szkic”) albo anulować plan.`);
      load();
    } catch (err) {
      setError(errText(err, "Nie udało się zaplanować."));
    } finally {
      setBusy(false);
    }
  };

  const unschedule = async (c) => {
    setError("");
    setBusy(true);
    try {
      await base44.functions.invoke("adminNewsletter", { action: "campaigns.unschedule", id: c.id });
      if (editor && editor.id === c.id) setEditor({ ...editor, status: "draft", scheduled_at: null });
      setInfo("Plan wysyłki anulowany — list wrócił do szkiców.");
      load();
    } catch (err) {
      setError(errText(err, "Nie udało się anulować."));
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await base44.functions.invoke("adminNewsletter", { action: "campaigns.preview", ...fields(editor) });
      setPreview({ html: r.data.html, w: 390 });
    } catch (err) {
      setError(errText(err, "Nie udało się przygotować podglądu."));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const r = await base44.functions.invoke("adminNewsletter", { action: "campaigns.test", ...fields(editor) });
      setInfo(`Wysłano list testowy na ${r.data.to}. Sprawdź, jak wygląda w Twojej skrzynce (także w telefonie).`);
    } catch (err) {
      setError(errText(err, "Nie udało się wysłać testu."));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!editor.id) {
      setError("Najpierw zapisz szkic kampanii.");
      return;
    }
    if (!window.confirm(`Wysłać „${editor.subject.trim()}" do ${remaining ?? "wszystkich"} odbiorców? Tego nie da się cofnąć.`)) return;
    setError("");
    setBusy(true);
    setSending({ sent: 0, total: null, failures: [] });
    let sent = 0;
    let failures = [];
    try {
      while (true) {
        const res = await base44.functions.invoke("adminNewsletter", {
          action: "campaigns.send",
          id: editor.id,
        });
        const d = res.data;
        sent += d.sent;
        failures = failures.concat(d.failures || []);
        setSending({ sent, total: sent + d.remaining, failures });
        if (d.done) break;
      }
      setRemaining(0);
      load();
    } catch (err) {
      setError(errText(err, "Wysyłka przerwana."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Usunąć kampanię „${c.subject}"?`)) return;
    setBusy(true);
    try {
      await base44.functions.invoke("adminNewsletter", { action: "campaigns.delete", id: c.id });
      if (editor && editor.id === c.id) setEditor(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  // ===== EDYTOR =====
  if (editor) {
    return (
      <div className="border hairline p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="relic-heading text-xl">{editor.id ? "EDYCJA KAMPANII" : "NOWA KAMPANIA"}</h3>
          <button onClick={() => setEditor(null)} className="text-foreground/40 hover:text-foreground p-2" aria-label="Zamknij">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="technical text-[10px] text-foreground/50 block mb-2">TEMAT</label>
        <input
          value={editor.subject}
          onChange={(e) => setEditor({ ...editor, subject: e.target.value })}
          className={`${inputCls} mb-1`}
          placeholder="np. Za tydzień: Wieczór Wszystkich Świętych"
          maxLength={120}
        />
        <p className={`text-[11px] mb-4 ${editor.subject.length > 60 ? "text-[#E8676A]" : "text-foreground/40"}`}>
          {editor.subject.length}/60 — krótki, konkretny temat bez krzyku (bez WIELKICH LITER i „!!!”) ma najlepszą otwieralność i rzadziej trafia do spamu.
        </p>

        <label className="technical text-[10px] text-foreground/50 block mb-2">ZAJAWKA (widoczna w skrzynce obok tematu)</label>
        <input
          value={editor.preheader}
          onChange={(e) => setEditor({ ...editor, preheader: e.target.value })}
          className={`${inputCls} mb-1`}
          placeholder="np. Dwie godziny o trzech śmierciach i czterech etapach powrotu."
          maxLength={140}
        />
        <p className="text-[11px] text-foreground/40 mb-4">Uzupełnia temat — nie powtarzaj go. Puste pole = pierwsze zdanie listu.</p>

        <div className="mb-4">
          <label htmlFor="camp-series" className="technical text-[10px] text-foreground/50 block mb-2">SERIA BIEŻĄCYCH LISTÓW (OPCJONALNIE, NP. „LISTOPAD 2026”)</label>
          <input id="camp-series" list="camp-series-list" value={editor.series_name || ""} onChange={(e) => setEditor({ ...editor, series_name: e.target.value })}
            className={inputCls} maxLength={80} placeholder="np. Listopad 2026" />
          <datalist id="camp-series-list">
            {[...new Set(campaigns.map((c) => c.series_name).filter(Boolean))].map((n) => <option key={n} value={n} />)}
          </datalist>
          <p className="text-[11px] text-foreground/40 mt-1">Tylko do porządku na liście. Bieżące listy dostają osoby, które ukończyły serię startową.</p>
        </div>

        <div className="mb-4">
          <label className="technical text-[10px] text-foreground/50 block mb-2">GRUPA ODBIORCÓW</label>
          <select
            value={editor.group_id}
            onChange={(e) => setEditor({ ...editor, group_id: e.target.value })}
            className={`${inputCls} bg-[#0A0A0B]`}
          >
            <option value="">WSZYSCY AKTYWNI</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {remaining !== null && (
            <p className="technical text-[9px] text-foreground/40 mt-2">ODBIORCY: {remaining}</p>
          )}
        </div>

        <RichTextEditor
          value={editor.content}
          onChange={(v) => setEditor({ ...editor, content: v })}
          placeholder="Treść listu do odbiorców…"
        />

        {(editor.buttons || []).map((b, i) => {
          const setB = (patch) => setEditor({ ...editor, buttons: editor.buttons.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mt-4 items-end">
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-2">
                  {i === 0 ? "PRZYCISK GŁÓWNY (ZŁOTY) — TEKST" : `PRZYCISK ${i + 1} (OBRYS) — TEKST`}
                </label>
                <input value={b.label} onChange={(e) => setB({ label: e.target.value })}
                  className={inputCls} placeholder={i === 0 ? "np. Zrób test" : "np. Zobacz Skarbiec"} maxLength={60} />
              </div>
              <div>
                <label className="technical text-[10px] text-foreground/50 block mb-2">LINK</label>
                <input value={b.url} onChange={(e) => setB({ url: e.target.value })}
                  className={inputCls} placeholder="exmortis.pl/test" />
              </div>
              <button type="button" onClick={() => setEditor({ ...editor, buttons: editor.buttons.length > 1 ? editor.buttons.filter((_, j) => j !== i) : [{ label: "", url: "" }] })}
                className="text-foreground/40 hover:blood-text p-2.5" aria-label={`Usuń przycisk ${i + 1}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        {(editor.buttons || []).length < MAX_BUTTONS && (
          <button type="button" onClick={() => setEditor({ ...editor, buttons: [...(editor.buttons || []), { label: "", url: "" }] })}
            className="technical text-[10px] gold-text mt-3 inline-flex items-center gap-1 hover:underline underline-offset-4">
            <Plus className="h-3 w-3" /> DODAJ PRZYCISK
          </button>
        )}
        <p className="text-[11px] text-foreground/40 mt-1">Do 3 przycisków pod treścią: pierwszy złoty, kolejne z obrysem. Link możesz wpisać bez https:// (np. exmortis.pl/test). Najlepiej działa jeden główny następny krok.</p>

        <div className="mt-6 border hairline p-4">
          <label htmlFor="camp-when" className="technical text-[10px] text-foreground/50 block mb-2">ZAPLANUJ WYSYŁKĘ (CZAS POLSKI)</label>
          {editor.status === "scheduled" && editor.scheduled_at && (
            <p className="text-sm gold-text mb-3">Zaplanowana na {plWhen(editor.scheduled_at)}.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input id="camp-when" type="datetime-local" value={editor.when || ""}
              onChange={(e) => setEditor({ ...editor, when: e.target.value })}
              className={`${inputCls} !w-auto bg-[#0A0A0B] [color-scheme:dark]`} />
            <button onClick={schedule} disabled={busy || !mailOk} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60">
              <CalendarClock className="h-4 w-4" /> {editor.status === "scheduled" ? "ZMIEŃ TERMIN" : "ZAPLANUJ"}
            </button>
            {editor.status === "scheduled" && (
              <button onClick={() => unschedule(editor)} disabled={busy} className="technical text-[10px] text-foreground/50 hover:blood-text underline underline-offset-4">
                ANULUJ PLAN
              </button>
            )}
          </div>
          <p className="text-[11px] text-foreground/40 mt-2">List wyjdzie sam o wybranej godzinie (z dokładnością do ok. 5 minut). Po wysyłce dostaniesz krótkie potwierdzenie e-mailem.</p>
        </div>
        {info && <p className="text-sm gold-text mt-3">{info}</p>}

        {error && <p className="text-sm blood-text mt-3">{error}</p>}

        {sending && (
          <div className="mt-4 border hairline p-4">
            <p className="technical text-[10px] gold-text">
              WYSYŁKA… {sending.sent} / {sending.total ?? "…"}
            </p>
            <div className="h-1 bg-[#3D3D3F] mt-2">
              <div
                className="h-1 bg-[#C9A24A] transition-all"
                style={{ width: `${sending.total ? Math.round((sending.sent / sending.total) * 100) : 0}%` }}
              />
            </div>
            {sending.failures.length > 0 && (
              <p className="text-xs text-foreground/40 mt-2">Nie udało się: {sending.failures.join(", ")}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={save} disabled={busy} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60">
            ZAPISZ SZKIC
          </button>
          <button onClick={showPreview} disabled={busy} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60">
            <Eye className="h-4 w-4" /> PODGLĄD
          </button>
          <button onClick={sendTest} disabled={busy || !mailOk} className="btn-ghost !px-5 !py-2.5 disabled:opacity-60">
            <FlaskConical className="h-4 w-4" /> WYŚLIJ TEST DO MNIE
          </button>
          <button onClick={send} disabled={busy || !mailOk} title={mailOk ? undefined : MAIL_REQUIRED} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">
            <Send className="h-4 w-4" /> WYŚLIJ
          </button>
          {!mailOk && <p className="technical text-[10px] text-foreground/40 self-center">{MAIL_REQUIRED.toUpperCase()}</p>}
        </div>

        {preview && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center p-4 overflow-auto" role="dialog" aria-modal="true" aria-label="Podgląd listu">
            <div className="flex items-center gap-2 mb-3 sticky top-0">
              <button onClick={() => setPreview({ ...preview, w: 390 })} className={`btn-ghost !px-4 !py-2 ${preview.w === 390 ? "!border-[#C9A24A]" : ""}`}><Smartphone className="h-4 w-4" /> TELEFON</button>
              <button onClick={() => setPreview({ ...preview, w: 720 })} className={`btn-ghost !px-4 !py-2 ${preview.w === 720 ? "!border-[#C9A24A]" : ""}`}><Monitor className="h-4 w-4" /> KOMPUTER</button>
              <button onClick={() => setPreview(null)} className="btn-ghost !px-4 !py-2" aria-label="Zamknij podgląd"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-foreground/60 mb-2 text-center max-w-md">Temat: <span className="text-foreground">{editor.subject || "—"}</span></p>
            <iframe title="Podgląd listu" srcDoc={preview.html} sandbox="" className="bg-[#0A0A0B] border hairline"
              style={{ width: Math.min(preview.w, typeof window !== "undefined" ? window.innerWidth - 32 : preview.w), height: "80vh" }} />
          </div>
        )}
      </div>
    );
  }

  // ===== LISTA =====
  return (
    <div>
      <button onClick={() => openEditor(null)} disabled={busy} className="btn-relic !px-5 !py-2.5 mb-8 disabled:opacity-60">
        <Plus className="h-4 w-4" /> NOWA KAMPANIA
      </button>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 border hairline animate-pulse bg-[#0F0F10]" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <p className="text-foreground/50 border hairline p-10 text-center">
          Brak kampanii — stwórz pierwszą i wyślij list do swojej listy powrotu.
        </p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/40">
          {[...campaigns]
            .sort((a, b) => String(a.series_name || "~").localeCompare(String(b.series_name || "~"), "pl")
              || new Date(b.scheduled_at || b.sent_date || b.created_date) - new Date(a.scheduled_at || a.sent_date || a.created_date))
            .map((c, i, arr) => (
            <React.Fragment key={c.id}>
            {(i === 0 || (arr[i - 1].series_name || "") !== (c.series_name || "")) && (
              <p className="technical text-[10px] gold-text px-3 pt-4 pb-2 bg-[#0A0A0B]">{c.series_name ? `SERIA: ${c.series_name.toUpperCase()}` : "POZOSTAŁE"}</p>
            )}
            <div className="flex items-center gap-3 p-3 hover:bg-[#0F0F10] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{c.subject}</p>
                <p className="text-xs text-foreground/40 truncate">
                  {c.group_name ? `GRUPA: ${c.group_name}` : "WSZYSCY AKTYWNI"} ·{" "}
                  {c.status === "scheduled" && c.scheduled_at
                    ? `WYJDZIE: ${plWhen(c.scheduled_at)}`
                    : new Date(c.sent_date || c.created_date).toLocaleDateString("pl-PL")}
                </p>
              </div>
              <span className="technical text-[9px] px-2 py-1 border border-[#C9A24A]/40 gold-text whitespace-nowrap">
                {Number(c.sent_count)} WYS.
              </span>
              <span
                className={`technical text-[9px] px-2 py-1 border whitespace-nowrap ${
                  c.status === "sent"
                    ? "hairline text-foreground/40"
                    : "border-[#C9A24A]/40 gold-text"
                }`}
              >
                {STATUS[c.status] || "SZKIC"}
              </span>
              {c.status === "scheduled" && (
                <button onClick={() => unschedule(c)} disabled={busy}
                  className="technical text-[9px] text-foreground/50 hover:blood-text underline underline-offset-4 px-1 whitespace-nowrap">
                  ANULUJ PLAN
                </button>
              )}
              {c.status !== "sent" && c.status !== "sending" && (
                <button
                  onClick={() => openEditor(c)}
                  className="text-foreground/50 hover:gold-text transition-colors p-2"
                  aria-label="Edytuj"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => remove(c)}
                disabled={busy}
                className="text-foreground/40 hover:blood-text transition-colors p-2"
                aria-label="Usuń"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}