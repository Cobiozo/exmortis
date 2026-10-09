import React, { useEffect, useState } from "react";
import { logAccess } from "@/lib/auditLog";
import { base44 } from "@/api/base44Client";

const safe = (v) => { const s = String(v ?? ""); return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`; };

// Uczestnicy serii: lista, ręczne dodanie/usunięcie, eksport CSV.
export default function Participants({ seria }) {
  const [list, setList] = useState([]);
  const [email, setEmail] = useState("");
  const load = () => base44.entities.ObokUczestnik.filter({ seria_id: seria.id }, { sort: "-joined_at", limit: 200 }).then((p) => setList(p.items));
  useEffect(() => { load(); }, [seria.id]);
  const add = async () => {
    const e = email.trim().toLowerCase(); if (!e.includes("@")) return;
    await base44.entities.ObokUczestnik.create({ seria_id: seria.id, user_email: e, joined_at: new Date().toISOString(), zrodlo: "admin", token: crypto.randomUUID() + crypto.randomUUID().slice(0, 8), wyslane: [] });
    setEmail(""); load();
  };
  const csv = async () => {
    logAccess("eksport", `Uczestnicy Obok: ${seria.slug} (CSV)`);
    const rows = []; let cursor;
    do { const p = await base44.entities.ObokUczestnik.filter({ seria_id: seria.id }, { limit: 500, cursor }); rows.push(...p.items); cursor = p.has_more ? p.next_cursor : null; } while (cursor);
    const txt = ["imie,email,dolaczenie,powiadomienia,zrodlo", ...rows.map((u) => [u.imie, u.user_email, u.joined_at, u.powiadomienia ? "tak" : "nie", u.zrodlo].map(safe).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\uFEFF" + txt], { type: "text/csv" })); a.download = `${seria.slug}-uczestnicy.csv`; a.click();
  };
  return (
    <section>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4"><p className="technical text-[10px] gold-text">UCZESTNICY ({list.length})</p><button onClick={csv} className="btn-ghost !py-2 !px-4">EKSPORT CSV</button></div>
      <div className="flex gap-3 mb-4"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail osoby" className="flex-1 bg-transparent border hairline px-4 py-2" /><button onClick={add} className="btn-ghost !py-2 !px-4">DODAJ</button></div>
      <ul className="border-t hairline">{list.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center gap-3 py-3 border-b hairline text-sm">
          <span className="flex-1 text-[#F5EFE1]">{u.imie || "—"} · {u.user_email}</span>
          <span className="text-foreground/45">{new Date(u.joined_at || u.created_date).toLocaleDateString("pl-PL")}</span>
          <span className="text-foreground/45">{u.powiadomienia ? "e-maile: tak" : "e-maile: nie"}</span>
          <button onClick={async () => { if (window.confirm("Usunąć tę osobę z serii?")) { await base44.entities.ObokUczestnik.delete(u.id); load(); } }} className="technical text-[10px] blood-text">USUŃ</button>
        </li>
      ))}</ul>
    </section>
  );
}