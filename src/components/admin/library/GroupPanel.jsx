import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, plDateTime } from "./libApi";

const STATUS = { WYSLANA: "wysłana", ZAPLANOWANA: "zaplanowana", SZKIC: "szkic", WYCOFANA: "wycofana" };

// Karta grupy: członkowie teraz, materiały grupy, wiadomości do grupy i dwie szybkie akcje.
export default function GroupPanel({ group, onWrite, onAssign }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setErr("");
    lib("group_detail", { id: group.id }).then(setD).catch((e) => { setErr(e.message); setD(null); });
  }, [group.id]);

  if (err) return <p className="text-sm blood-text">{err}</p>;
  if (!d) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;

  return (
    <div className="border-t hairline pt-4 space-y-5">
      <div className="flex flex-wrap gap-2">
        <button className="btn-relic !px-3 !py-2" onClick={() => onWrite(group)}>NAPISZ DO GRUPY</button>
        <button className="btn-ghost !px-3 !py-2" onClick={() => onAssign(group)}>PRZYDZIEL GRUPIE</button>
      </div>

      <div>
        <p className="technical text-[10px] text-foreground/50 mb-2">CZŁONKOWIE ({d.members.length})</p>
        <div className="text-xs text-foreground/60 space-y-1 max-h-40 overflow-y-auto">
          {d.members.length ? d.members.map((p) => <p key={p.email}>{p.name ? `${p.name} · ` : ""}{p.email}</p>)
            : <p className="text-foreground/40">Nikt nie pasuje do tej reguły.</p>}
        </div>
      </div>

      <div>
        <p className="technical text-[10px] text-foreground/50 mb-2">MATERIAŁY GRUPY ({d.materials.length})</p>
        <div className="text-xs text-foreground/60 space-y-1 max-h-40 overflow-y-auto">
          {d.materials.length ? d.materials.map((a) => (
            <p key={a.id}>
              {a.material_title || a.collection_title || "—"}{a.collection_id ? " · kolekcja" : ""}
              {a.visible_to ? ` · do ${plDateTime(a.visible_to)}` : ""}
            </p>
          )) : <p className="text-foreground/40">Brak przydziałów dla tej grupy.</p>}
        </div>
      </div>

      <div>
        <p className="technical text-[10px] text-foreground/50 mb-2">WIADOMOŚCI DO GRUPY ({d.messages.length})</p>
        <div className="text-xs text-foreground/60 space-y-1 max-h-40 overflow-y-auto">
          {d.messages.length ? d.messages.map((m) => (
            <p key={m.id}>
              {m.title || "(bez tytułu)"} · {STATUS[m.status] || m.status}
              {m.sent_at ? ` ${plDateTime(m.sent_at)} · przeczytane ${m.przeczytane} / ${m.recipient_count}` : ""}
            </p>
          )) : <p className="text-foreground/40">Brak wiadomości.</p>}
        </div>
      </div>
    </div>
  );
}