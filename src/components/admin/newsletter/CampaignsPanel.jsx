import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, X, Pencil, Send, Eye, Smartphone, Monitor, FlaskConical } from "lucide-react";
import RichTextEditor from "@/components/admin/RichTextEditor";
import useMailStatus, { MAIL_REQUIRED } from "@/lib/useMailStatus";

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";

const EMPTY = { id: null, subject: "", content: "", group_id: "", preheader: "", cta_label: "", cta_url: "" };
const fields = (e) => ({ subject: e.subject, content: e.content, preheader: e.preheader, cta_label: e.cta_label, cta_url: e.cta_url });

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
          cta_label: camp.cta_label || "",
          cta_url: camp.cta_url || "",
        });
        setRemaining(res.data.remaining);
      } else {
        setEditor({ ...EMPTY });
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się otworzyć kampanii.");
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
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się zapisać.");
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
      setError(err?.response?.data?.error || "Nie udało się przygotować podglądu.");
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
      setError(err?.response?.data?.error || "Nie udało się wysłać testu.");
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
      setError(err?.response?.data?.error || "Wysyłka przerwana.");
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

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">PRZYCISK — TEKST (opcjonalnie)</label>
            <input value={editor.cta_label} onChange={(e) => setEditor({ ...editor, cta_label: e.target.value })}
              className={inputCls} placeholder="np. Zapisz się na 1 listopada" maxLength={60} />
          </div>
          <div>
            <label className="technical text-[10px] text-foreground/50 block mb-2">PRZYCISK — LINK</label>
            <input value={editor.cta_url} onChange={(e) => setEditor({ ...editor, cta_url: e.target.value })}
              className={inputCls} placeholder="https://exmortis.pl/…" />
          </div>
        </div>
        <p className="text-[11px] text-foreground/40 mt-1">Jeden list = jeden następny krok. Złoty przycisk pojawi się pod treścią.</p>
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
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-[#0F0F10] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{c.subject}</p>
                <p className="text-xs text-foreground/40 truncate">
                  {c.group_name ? `GRUPA: ${c.group_name}` : "WSZYSCY AKTYWNI"} ·{" "}
                  {new Date(c.sent_date || c.created_date).toLocaleDateString("pl-PL")}
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
                {c.status === "sent" ? "WYSŁANA" : "SZKIC"}
              </span>
              {c.status !== "sent" && (
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