import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { lib, plDateTime } from "./libApi";

// Istniejące przydziały materiału albo kolekcji — z odebraniem pojedynczo i dla całej grupy.
export default function AssignList({ materialId, collectionId, version, onChange }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    lib("assignments_of_material", { material_id: materialId, collection_id: collectionId })
      .then(setD).catch((e) => { setErr(e.message); setD({ items: [], odbiorcy: 0 }); });
  };
  useEffect(() => { load(); }, [materialId, collectionId, version]);

  const revoke = async (id, key) => {
    setBusy(key); setErr("");
    try { await lib("assignment_revoke", { id }); load(); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };
  const revokeGroup = async (a) => {
    setBusy(a.id); setErr("");
    try { await lib("assignment_revoke", { material_id: materialId, collection_id: collectionId, group_id: a.group_id }); load(); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  if (!d) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;
  const live = d.items.filter((a) => !a.revoked_at);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="technical text-[10px] text-foreground/50">OBECNE PRZYDZIAŁY</p>
        <p className="text-xs text-foreground/50">Osób z dostępem: {d.odbiorcy}</p>
      </div>
      {err && <p className="text-xs blood-text">{err}</p>}
      {live.length === 0 ? (
        <p className="text-sm text-foreground/45">Nikt jeszcze nie ma dostępu.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {live.map((a) => (
            <div key={a.id} className="p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {a.target_kind === "osoba" ? a.target_email : `Grupa: ${a.group?.name || "—"}`}
                  {a.group_mode === "TYLKO_OBECNI" ? " (tylko obecni)" : ""}
                </p>
                <p className="text-[11px] text-foreground/45">
                  {a.people} {a.people === 1 ? "osoba" : "osób"}
                  {a.sample?.length ? ` · ${a.sample.join(", ")}` : ""}
                  {a.visible_from ? ` · od ${plDateTime(a.visible_from)}` : ""}
                  {a.visible_to ? ` · do ${plDateTime(a.visible_to)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {a.target_kind === "grupa" && (
                  <button className="btn-ghost !px-3 !py-2" onClick={() => revokeGroup(a)} disabled={busy === a.id}>ODEBIERZ GRUPIE</button>
                )}
                <button className="btn-ghost !px-3 !py-2" onClick={() => revoke(a.id, a.id)} disabled={busy === a.id} title="Odbierz dostęp">
                  {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}