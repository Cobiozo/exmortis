import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { lib } from "./libApi";
import MessageForm from "./MessageForm";
import MessageRow from "./MessageRow";
import TemplatesTab from "./TemplatesTab";

const TABS = [
  ["WYSLANA", "Wysłane", "wyslane"],
  ["ZAPLANOWANA", "Zaplanowane", "zaplanowane"],
  ["SZKIC", "Szkice", "szkice"],
  ["SZABLONY", "Szablony", null],
];

// Sekcja panelu „Wiadomości" — widoczna, gdy moduł nie jest wyłączony.
export default function MessagesPanel({ presetTarget }) {
  const [mode, setMode] = useState(undefined);
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("WYSLANA");
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    lib("messages_list").then(setD).catch((e) => { setErr(e.message); setD({ items: [], liczniki: {} }); });
  };

  useEffect(() => {
    lib("settings").then((r) => setMode(r.settings.messages_mode)).catch(() => setMode("off"));
  }, []);
  useEffect(() => { if (mode && mode !== "off") load(); }, [mode]);

  if (mode === undefined) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  if (mode === "off") return (
    <p className="text-sm text-foreground/50">Moduł wiadomości jest wyłączony (Ustawienia strony → Moduły).</p>
  );

  const cnt = d?.liczniki || {};
  // Wycofane zostają w widoku „Wysłane" — tam można je usunąć.
  const items = (d?.items || []).filter((m) => m.status === tab || (tab === "WYSLANA" && m.status === "WYCOFANA"));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b hairline">
        <div className="flex flex-wrap gap-2">
          {TABS.map(([k, l, c]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-3 technical text-[10px] border-b-2 -mb-px ${tab === k ? "border-[#C9A24A] gold-text" : "border-transparent text-foreground/50 hover:gold-text"}`}>
              {l}{c && cnt[c] !== undefined ? ` (${cnt[c]})` : ""}
            </button>
          ))}
        </div>
        <button className="btn-relic mb-2" onClick={() => setForm({ presetTarget })}><Plus className="h-4 w-4" /> NOWA WIADOMOŚĆ</button>
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}

      {tab === "SZABLONY" ? (
        <TemplatesTab onUse={(t) => setForm({ template: t })} />
      ) : !d ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : items.length === 0 ? (
        <p className="text-sm text-foreground/50">Brak wiadomości w tym widoku.</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MessageRow key={m.id} m={m} onChanged={load} onEdit={(x, sent) => setForm({ item: x, editSent: sent })} />
          ))}
        </div>
      )}

      {form && (
        <MessageForm
          open onClose={() => setForm(null)}
          item={form.item} editSent={form.editSent} template={form.template} presetTarget={form.presetTarget}
          onDone={() => { setForm(null); load(); }}
        />
      )}
    </div>
  );
}