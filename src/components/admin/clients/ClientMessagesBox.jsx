import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, inputCls, plDateTime } from "@/components/admin/library/libApi";
import AssignDialog from "@/components/admin/library/AssignDialog";
import MessageForm from "@/components/admin/library/MessageForm";
import { base44 } from "@/api/base44Client";

// Sekcja „Wiadomości" karty klienta i szybkie akcje. „Umów sesję" pokazuje się tylko, gdy moduł rezerwacji działa.
export default function ClientMessagesBox({ email, onChange }) {
  const [d, setD] = useState(null);
  const [grupy, setGrupy] = useState([]);
  const [bookOn, setBookOn] = useState(false);
  const [assign, setAssign] = useState(false);
  const [write, setWrite] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    lib("client_detail", { email }).then(setD).catch((e) => { setErr(e.message); setD(null); });
  };

  useEffect(() => {
    load();
    lib("groups_list").then((r) => setGrupy(r.items.filter((g) => g.kind === "RECZNA"))).catch(() => {});
    base44.functions.invoke("bookingAdmin", { action: "status" })
      .then((r) => setBookOn(r.data.mode !== "off")).catch(() => setBookOn(false));
  }, [email]);

  const addGroup = async (gid) => {
    if (!gid) return;
    setBusy("add"); setErr("");
    try { await lib("group_members_add", { group_id: gid, emails: [email] }); load(); onChange?.(); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  };

  if (!d) return err ? <p className="text-sm blood-text">{err}</p> : <Loader2 className="h-5 w-5 animate-spin gold-text" />;

  return (
    <section className="space-y-4">
      <p className="technical text-[10px] gold-text">WIADOMOŚCI</p>

      <div className="flex flex-wrap gap-2">
        <button className="btn-relic !px-3 !py-2" onClick={() => setWrite(true)}>NAPISZ WIADOMOŚĆ</button>
        <button className="btn-ghost !px-3 !py-2" onClick={() => setAssign(true)}>PRZYDZIEL MATERIAŁ</button>
        <select onChange={(e) => { addGroup(e.target.value); e.target.value = ""; }} disabled={busy === "add"} className={`${inputCls} max-w-[220px]`}>
          <option value="">— dodaj do grupy —</option>
          {grupy.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {bookOn && <a href="/admin/rezerwacje" className="btn-ghost !px-3 !py-2">UMÓW SESJĘ</a>}
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}

      {d.messages?.length ? (
        <div className="border hairline divide-y divide-[#3D3D3F]/60">
          {d.messages.map((m) => (
            <div key={m.id} className="p-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-sm min-w-0 flex-1 truncate">{m.title || "(bez tytułu)"}</span>
              <span className="text-[11px] text-foreground/45">{plDateTime(m.sent_at)}</span>
              <span className={`technical text-[10px] ${m.read_at ? "gold-text" : "text-foreground/40"}`}>
                {m.read_at ? "PRZECZYTANE" : "NIEPRZECZYTANE"}
              </span>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-foreground/45">Brak wiadomości do tej osoby.</p>}

      {write && (
        <MessageForm open onClose={() => setWrite(false)}
          presetTarget={{ kind: "osoba", emails: [email], group_id: "", group_mode: "OBECNI_I_PRZYSZLI", exceptions_add: [], exceptions_drop: [] }}
          onDone={() => { setWrite(false); load(); onChange?.(); }} />
      )}
      {assign && (
        <AssignDialog open onClose={() => setAssign(false)} presetEmails={[email]}
          label={`Osoba: ${email}`} onDone={() => { setAssign(false); load(); onChange?.(); }} />
      )}
    </section>
  );
}