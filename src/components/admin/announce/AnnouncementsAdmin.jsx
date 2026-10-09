import React, { useEffect, useState } from "react";
import { ann } from "@/components/account/announce/annApi";
import AnnForm from "./AnnForm";
import AnnRow from "./AnnRow";
import { EMPTY, fmtPl } from "./annForm";

// Panel → Ogłoszenia (tylko na stronie, bez e-maili). Dostęp: wyłącznie administrator.
export default function AnnouncementsAdmin() {
  const [data, setData] = useState(null);
  const [options, setOptions] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => ann("list").then(setData).catch((e) => setErr(e.response?.data?.error || e.message));
  useEffect(() => { load(); ann("options").then(setOptions).catch(() => setOptions({})); }, []);

  const run = async (fn) => {
    setBusy(true); setErr("");
    try { await fn(); await load(); } catch (e) { setErr(e.response?.data?.error || e.message); } finally { setBusy(false); }
  };
  const save = (item, action) => run(async () => { await ann(action, { item }); setEdit(null); });

  return (
    <div className="space-y-8">
      <p className="text-sm text-foreground/60 max-w-[70ch]">Krótkie ogłoszenia widoczne w Moim koncie nad „Myślą na dziś”. Tylko na stronie — bez wysyłki e-mail. Zmiany widać przy kolejnym wejściu albo w ciągu 5 minut.</p>
      {err && <p role="alert" className="text-sm text-[#BC1E22]">{err}</p>}
      {edit ? <AnnForm key={edit.id || "nowe"} initial={{ ...EMPTY, ...edit }} options={options} busy={busy} onSave={save} onCancel={() => setEdit(null)} />
        : <button className="btn-relic" onClick={() => setEdit({ ...EMPTY })}>Nowe ogłoszenie</button>}
      {!data ? <p className="text-sm text-foreground/50">Wczytuję…</p> : (
        <div className="space-y-3">
          {!data.items.length && <p className="text-sm text-foreground/50">Brak ogłoszeń.</p>}
          {data.items.map((a) => <AnnRow key={a.id} a={a} onEdit={() => setEdit(a)} onAct={(action) => run(() => ann(action, { id: a.id }))} />)}
        </div>
      )}
      {data?.logs?.length > 0 && (
        <details className="border border-[#3D3D3F] p-4">
          <summary className="technical text-[10px] cursor-pointer min-h-[44px] flex items-center">Dziennik zmian</summary>
          <ul className="mt-3 space-y-1 text-xs text-foreground/70">
            {data.logs.map((l) => <li key={l.id}>{fmtPl(l.created_date)} · {l.kto} · {l.akcja} · „{l.tytul}”</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}