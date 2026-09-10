import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, X, Check, Pencil, Send } from "lucide-react";
import RichTextEditor from "@/components/admin/RichTextEditor";

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";

const EMPTY = { id: null, subject: "", content: "", group_id: "" };

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(null);
  const [error, setError] = useState("");

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
        subject: editor.subject,
        content: editor.content,
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

  const send = async () => {
    if (!editor.id) {
      setError("Najpierw zapisz szkic kampanii.");
      return;
    }
    if (!window.confirm(`Wysłać „${editor.subject.trim()}" do odbiorców?`)) return;
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

        <input
          value={editor.subject}
          onChange={(e) => setEditor({ ...editor, subject: e.target.value })}
          className={`${inputCls} mb-4`}
          placeholder="Temat wiadomości"
        />

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
          <button onClick={send} disabled={busy} className="btn-relic !px-5 !py-2.5 disabled:opacity-60">
            <Send className="h-4 w-4" /> WYŚLIJ
          </button>
        </div>
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