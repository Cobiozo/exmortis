import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { lib, inputCls } from "@/components/admin/library/libApi";
import LibModal from "@/components/admin/library/LibModal";
import AssignDialog from "@/components/admin/library/AssignDialog";
import ClientDetail from "./ClientDetail";

const Badge = ({ g }) => (
  <span className="inline-flex items-center gap-1 border hairline px-2 py-0.5 text-[10px] text-foreground/70">
    <span className="h-2 w-2" style={{ background: g.color || "#3D3D3F" }} />{g.name}
  </span>
);

// Rozbudowana lista klientów: filtry grup, checkboxy, akcje zbiorcze. Jedna lista, nie druga.
export default function ClientsLibraryList() {
  const [items, setItems] = useState(null);
  const [grupy, setGrupy] = useState([]);
  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupMode, setGroupMode] = useState("all");
  const [noGroup, setNoGroup] = useState(false);
  const [hasPackage, setHasPackage] = useState(false);
  const [sel, setSel] = useState([]);
  const [picked, setPicked] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [assign, setAssign] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    lib("clients_list", { q, group_ids: groupId ? [groupId] : [], group_mode: groupMode, no_group: noGroup, has_package: hasPackage })
      .then((d) => { setItems(d.items); setGrupy(d.grupy || []); setSel([]); })
      .catch((e) => { setErr(e.message); setItems([]); });
  };

  // Każde zawężenie to nowe zapytanie do serwera.
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, groupId, groupMode, noGroup, hasPackage]);

  const emails = items ? items.map((c) => c.email) : [];
  const toggle = (e) => setSel((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]));

  const runBulk = async (c) => {
    setConfirm(null); setBusy(true); setErr("");
    try {
      await lib(c.kind === "add" ? "group_members_add" : "group_members_remove", { group_id: c.group_id, emails: sel });
      setSel([]); load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Do 10 osób działa od razu (jeśli grupa jest już wybrana w filtrze), powyżej — okno z podsumowaniem.
  const ask = (kind) => {
    if (!sel.length) return;
    if (sel.length <= 10 && groupId) { runBulk({ kind, group_id: groupId }); return; }
    setConfirm({ kind, group_id: groupId });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-10">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/35" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Szukaj osoby lub e-maila" className={`${inputCls} pl-9`} />
        </div>

        <div className="flex flex-wrap gap-3">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${inputCls} flex-1 min-w-[160px]`}>
            <option value="">Wszystkie grupy</option>
            {grupy.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={groupMode} onChange={(e) => setGroupMode(e.target.value)} className={`${inputCls} max-w-[150px]`} disabled={!groupId}>
            <option value="all">Wszystkie z</option>
            <option value="any">Którykolwiek z</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={noGroup} onChange={(e) => setNoGroup(e.target.checked)} className="accent-[#C9A24A]" /> Bez grupy</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={hasPackage} onChange={(e) => setHasPackage(e.target.checked)} className="accent-[#C9A24A]" /> Ma aktywny pakiet</label>
          <span className="text-foreground/40">Wyników: {items ? items.length : "…"}</span>
        </div>

        {sel.length > 0 && (
          <div className="border hairline p-3 space-y-2">
            <p className="text-sm">Wybrane: {sel.length}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSel(emails)} className="btn-ghost !px-3 !py-2">ZAZNACZ WSZYSTKIE WYNIKI FILTRA</button>
              <button onClick={() => ask("add")} disabled={!grupy.length} className="btn-ghost !px-3 !py-2">DODAJ DO GRUPY</button>
              <button onClick={() => ask("remove")} disabled={!grupy.length} className="btn-ghost !px-3 !py-2">USUŃ Z GRUPY</button>
              <button onClick={() => setAssign(true)} className="btn-relic !px-3 !py-2">PRZYDZIEL MATERIAŁ</button>
              <button onClick={() => setSel([])} className="btn-ghost !px-3 !py-2">WYCZYŚĆ</button>
            </div>
          </div>
        )}

        {err && <p className="text-sm blood-text">{err}</p>}

        {!items ? <Loader2 className="h-5 w-5 animate-spin gold-text" /> : items.length === 0 ? (
          <p className="text-sm text-foreground/50">Brak osób dla tych filtrów.</p>
        ) : (
          <div className="border hairline divide-y divide-[#3D3D3F]/60">
            <div className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" checked={sel.length > 0 && sel.length === emails.length}
                onChange={(e) => setSel(e.target.checked ? emails : [])} className="accent-[#C9A24A]" />
              <span className="text-[10px] technical text-foreground/40">ZAZNACZ WSZYSTKIE WYNIKI</span>
            </div>
            {items.map((c) => (
              <div key={c.email} className={`px-3 py-3 flex flex-wrap items-center gap-3 ${picked === c.email ? "bg-[#0F0F10]" : ""}`}>
                <input type="checkbox" checked={sel.includes(c.email)} onChange={() => toggle(c.email)} className="accent-[#C9A24A]" />
                <button onClick={() => setPicked(c.email)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm truncate">{c.name || c.email}</span>
                  {c.name && <span className="block text-[11px] text-foreground/40 truncate">{c.email}</span>}
                  {c.package && <span className="technical text-[10px] gold-text">AKTYWNY PAKIET</span>}
                </button>
                <div className="flex flex-wrap gap-1 max-w-[45%] justify-end">
                  {c.groups?.length ? c.groups.map((g) => <Badge key={g.id} g={g} />) : <span className="text-[11px] text-foreground/30">bez grupy</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        {picked ? <ClientDetail key={picked} email={picked} libOn onChange={load} /> : (
          <p className="text-sm text-foreground/45">Wybierz osobę, aby zobaczyć jej grupy, materiały i przydziały.</p>
        )}
      </div>

      {assign && <AssignDialog open onClose={() => setAssign(false)} presetEmails={sel} label={`Wybrane osoby: ${sel.length}`} onDone={() => { setAssign(false); load(); }} />}

      <LibModal
        open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === "add" ? "Dodać do grupy?" : "Usunąć z grupy?"}
        footer={<>
          <button className="btn-ghost" onClick={() => setConfirm(null)}>ANULUJ</button>
          <button className="btn-relic" onClick={() => runBulk(confirm)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "WYKONAJ"}</button>
        </>}
      >
        <p className="text-sm text-foreground/70">
          {confirm?.kind === "add" ? "Dodaję" : "Usuwam"} {sel.length} {sel.length === 1 ? "osobę" : "osób"} {confirm?.kind === "add" ? "do grupy" : "z grupy"}:
        </p>
        <div className="text-xs text-foreground/60 max-h-40 overflow-y-auto space-y-1">
          {sel.map((e) => <p key={e}>{e}</p>)}
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">GRUPA</label>
          <select value={confirm?.group_id || ""} onChange={(e) => setConfirm((c) => ({ ...c, group_id: e.target.value }))} className={inputCls}>
            <option value="">— wybierz —</option>
            {grupy.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </LibModal>
    </div>
  );
}