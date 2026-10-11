import React, { useEffect, useState } from "react";
import { Loader2, X, Plus } from "lucide-react";
import { lib, inputCls, KIND_LABEL, plDate } from "@/components/admin/library/libApi";
import ClientMessagesBox from "./ClientMessagesBox";
// Sekcja „Wiadomości" karty klienta żyje we własnym pliku (historia, stan przeczytania, szybkie akcje).

const Dot = ({ c }) => <span className="h-2.5 w-2.5 inline-block" style={{ background: c || "#3D3D3F" }} />;

// Część karty klienta należąca do modułu: grupy, materiały, przydziały.
// „Wiadomości" i „Pakiety i sesje" to miejsca zarezerwowane na 1B-2 i 1C.
export default function ClientLibraryBox({ email, onChange }) {
  const [d, setD] = useState(null);
  const [grupy, setGrupy] = useState([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    lib("client_detail", { email }).then(setD).catch((e) => { setErr(e.message); setD(null); });
  };
  useEffect(() => { load(); lib("groups_list").then((r) => setGrupy(r.items)).catch(() => {}); }, [email]);

  const addGroup = async (gid) => {
    if (!gid) return;
    setBusy("add"); setErr("");
    try { await lib("group_members_add", { group_id: gid, emails: [email] }); load(); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };
  const removeGroup = async (gid) => {
    setBusy(gid); setErr("");
    try { await lib("group_members_remove", { group_id: gid, emails: [email] }); load(); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };
  const revoke = async (id) => {
    setBusy(id); setErr("");
    try { await lib("assignment_revoke", { id }); load(); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  if (!d) return err ? <p className="text-sm blood-text">{err}</p> : <Loader2 className="h-5 w-5 animate-spin gold-text" />;
  const manual = grupy.filter((g) => g.kind === "RECZNA");
  const mine = new Set((d.groups || []).map((g) => g.id));

  return (
    <div className="space-y-10">
      {err && <p className="text-sm blood-text">{err}</p>}

      <section>
        <p className="technical text-[10px] gold-text mb-3">GRUPY</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {d.groups?.length ? d.groups.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-2 border hairline px-2 py-1 text-xs">
              <Dot c={g.color} />{g.name}
              {g.kind === "AUTOMATYCZNA" ? (
                <span className="text-[10px] text-foreground/40">automatyczna</span>
              ) : (
                <button onClick={() => removeGroup(g.id)} disabled={busy === g.id} title="Usuń z grupy"><X className="h-3 w-3 text-foreground/50 hover:blood-text" /></button>
              )}
            </span>
          )) : <span className="text-xs text-foreground/40">Bez grup.</span>}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Plus className="h-4 w-4 text-foreground/40" />
          <select onChange={(e) => { addGroup(e.target.value); e.target.value = ""; }} disabled={busy === "add"} className={`${inputCls} max-w-[260px]`}>
            <option value="">— dodaj do grupy —</option>
            {manual.filter((g) => !mine.has(g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </section>

      <section>
        <p className="technical text-[10px] gold-text mb-3">MATERIAŁY</p>
        {d.materials?.length ? (
          <div className="border hairline divide-y divide-[#3D3D3F]/60">
            {d.materials.map((m) => (
              <div key={m.id} className="p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{m.title}</p>
                  <p className="text-[11px] text-foreground/45">
                    {KIND_LABEL[m.kind]}
                    {m.visible_from ? ` · od ${plDate(m.visible_from)}` : ""}
                    {m.visible_to ? ` · do ${plDate(m.visible_to)}` : ""}
                  </p>
                </div>
                <span className={`technical text-[10px] ${m.opened_at ? "gold-text" : "text-foreground/40"}`}>
                  {m.opened_at ? "OTWARTE" : "NIEPRZECZYTANE"}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-foreground/45">Brak materiałów.</p>}
      </section>

      <section>
        <p className="technical text-[10px] gold-text mb-3">PRZYDZIAŁY</p>
        {d.assignments?.length ? (
          <div className="border hairline divide-y divide-[#3D3D3F]/60">
            {d.assignments.map((a) => (
              <div key={a.id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{a.material_title || a.collection_title || "—"}</p>
                  <p className="text-[11px] text-foreground/45">
                    {a.target_kind === "osoba" ? "wprost" : `grupa: ${a.group_name || "—"}`}
                    {a.collection_id ? " · kolekcja" : ""}
                    {a.note ? ` · ${a.note}` : ""}
                  </p>
                </div>
                <button onClick={() => revoke(a.id)} disabled={busy === a.id} className="btn-ghost !px-3 !py-2">
                  {busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "ODEBIERZ"}
                </button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-foreground/45">Brak przydziałów.</p>}
      </section>

      <ClientMessagesBox email={email} onChange={onChange} />

      <section>
        <p className="technical text-[10px] gold-text mb-3">PAKIETY I SESJE</p>
        <p className="text-sm text-foreground/45">W przygotowaniu.</p>
      </section>
    </div>
  );
}