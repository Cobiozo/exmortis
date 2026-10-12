import React, { useCallback, useEffect, useState } from "react";
import { bk, inputCls } from "./api";

// Dostęp do spotkań indywidualnych (POWRÓT) i pakiety klientów.
// Nadanie dostępu = potwierdzenie, że osoba jest w programie. Parametry domyślne i każdej osoby osobno można zmieniać.
const dateOnly = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const plDate = (v) => new Date(v).toLocaleDateString("pl-PL");
const addMonths = (m) => { const d = new Date(); d.setMonth(d.getMonth() + Number(m || 6)); return dateOnly(d); };

function statusOf(p) {
  if (p.payment_status !== "oplacony") return ["płatność: " + p.payment_status, "text-foreground/50"];
  if (new Date(p.valid_until).getTime() <= Date.now()) return ["zakończony", "text-foreground/40"];
  if (p.sessions_used >= p.sessions_total) return ["wykorzystany", "text-foreground/50"];
  return ["aktywny", "gold-text"];
}

function Num({ label, value, onChange, min = 0, max = 100 }) {
  return (
    <label className="block text-xs text-foreground/60 space-y-1">
      <span>{label}</span>
      <input type="number" min={min} max={max} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TypeSelect({ types, value, onChange, by = "id" }) {
  return (
    <label className="block text-xs text-foreground/60 space-y-1">
      <span>Rodzaj spotkania</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {types.map((t) => <option key={t.id} value={t[by]}>{t.name}{t.active ? "" : " (nieaktywny)"}</option>)}
      </select>
    </label>
  );
}

function Grant({ types, defaults, onDone }) {
  const defType = types.find((t) => t.slug === defaults.type_slug)?.id || types[0]?.id || "";
  const [f, setF] = useState({ email: "", type_id: defType, sessions_total: defaults.sessions, min_gap_days: defaults.gap_days, valid_until: addMonths(defaults.valid_months) });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await bk("grant_package", f);
      setMsg(r.has_account ? "Dostęp nadany. Osoba zobaczy go w koncie → Umów spotkanie." : "Dostęp nadany. Ta osoba nie ma jeszcze konta — zobaczy dostęp po założeniu konta na ten sam adres e-mail.");
      setF((x) => ({ ...x, email: "" }));
      onDone();
    } catch (e2) { setMsg(e2.message); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="border border-[#C9A24A]/50 p-5 space-y-4">
      <div>
        <p className="technical text-[10px] gold-text">NADAJ DOSTĘP — UCZESTNIK PROGRAMU POWRÓT</p>
        <p className="text-xs text-foreground/50 mt-1">Po nadaniu osoba może sama umawiać spotkania w koncie, w granicach poniższych parametrów.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr_1.4fr]">
        <label className="block text-xs text-foreground/60 space-y-1">
          <span>E-mail konta uczestnika</span>
          <input type="email" required maxLength={200} className={inputCls} value={f.email} onChange={(e) => set("email")(e.target.value)} />
        </label>
        <TypeSelect types={types} value={f.type_id} onChange={set("type_id")} />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Num label="Liczba spotkań" value={f.sessions_total} onChange={set("sessions_total")} min={1} />
        <Num label="Odstęp min. (dni)" value={f.min_gap_days} onChange={set("min_gap_days")} max={90} />
        <label className="block text-xs text-foreground/60 space-y-1 col-span-2 md:col-span-1">
          <span>Dostęp ważny do</span>
          <input type="date" required className={inputCls} value={f.valid_until} onChange={(e) => set("valid_until")(e.target.value)} />
        </label>
      </div>
      {msg && <p className="text-sm text-[#E8C547]" role="status">{msg}</p>}
      <button type="submit" disabled={busy || !f.type_id} className="btn-relic text-[10px] disabled:opacity-40">{busy ? "ZAPISUJĘ…" : "NADAJ DOSTĘP"}</button>
    </form>
  );
}

function Defaults({ types, defaults, onSaved }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(defaults);
  const [msg, setMsg] = useState("");
  useEffect(() => setF(defaults), [defaults]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setMsg("");
    try { const r = await bk("powrot_defaults", f); onSaved(r.defaults); setMsg("Zapisane. Dotyczy nowych dostępów — istniejące zmieniasz na liście."); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <div className="border hairline p-5">
      <button type="button" onClick={() => setOpen(!open)} className="technical text-[10px] text-foreground/60 hover:gold-text">
        {open ? "▾" : "▸"} PARAMETRY DOMYŚLNE · {defaults.sessions} spotkań · co {defaults.gap_days} dni · {defaults.valid_months} mies.
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="col-span-2 md:col-span-1"><TypeSelect types={types} value={f.type_slug} onChange={set("type_slug")} by="slug" /></div>
            <Num label="Liczba spotkań" value={f.sessions} onChange={set("sessions")} min={1} />
            <Num label="Odstęp min. (dni)" value={f.gap_days} onChange={set("gap_days")} max={90} />
            <Num label="Ważność (miesiące)" value={f.valid_months} onChange={set("valid_months")} min={1} max={36} />
          </div>
          {msg && <p className="text-sm text-[#E8C547]">{msg}</p>}
          <button type="button" onClick={save} className="btn-ghost text-[10px]">ZAPISZ PARAMETRY</button>
        </div>
      )}
    </div>
  );
}

function Row({ p, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ sessions_total: p.sessions_total, min_gap_days: p.min_gap_days, valid_until: dateOnly(p.valid_until) });
  const [ending, setEnding] = useState(false);
  useEffect(() => setF({ sessions_total: p.sessions_total, min_gap_days: p.min_gap_days, valid_until: dateOnly(p.valid_until) }), [p.sessions_total, p.min_gap_days, p.valid_until]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [label, cls] = statusOf(p);
  const active = label === "aktywny";

  const run = async (kind, fn) => {
    setBusy(kind); setErr("");
    try { await fn(); setEdit(false); setEnding(false); await onChanged(); }
    catch (e) { setErr(e.message); }
    setBusy("");
  };
  const next = p.last_start && p.min_gap_days ? new Date(new Date(p.last_start).getTime() + p.min_gap_days * 864e5) : null;

  return (
    <div className="border hairline p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm break-all">{p.email || "—"} <span className={`technical text-[9px] ml-2 ${cls}`}>{label.toUpperCase()}</span></p>
          <p className="text-xs text-foreground/50">
            {p.type} · wykorzystane {p.sessions_used} / {p.sessions_total} · co {p.min_gap_days} dni · do {plDate(p.valid_until)}
            {p.source === "zamowienie" ? " · z zamówienia" : " · nadany ręcznie"}
          </p>
          {active && next && next.getTime() > Date.now() && <p className="text-xs text-foreground/40">Kolejne spotkanie najwcześniej {plDate(next)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEdit(!edit)} className="btn-ghost text-[10px]">{edit ? "ANULUJ" : "ZMIEŃ"}</button>
          <button onClick={() => run("give", () => bk("return_session", { package_id: p.id, note: "oddanie sesji w panelu" }))}
            disabled={!!busy || p.sessions_used === 0} className="btn-ghost text-[10px] disabled:opacity-40">
            {busy === "give" ? "ODDAJĘ…" : "ODDAJ SESJĘ"}
          </button>
          {new Date(p.valid_until).getTime() > Date.now() && (ending ? (
            <button onClick={() => run("end", () => bk("update_package", { package_id: p.id, end_now: true }))} disabled={!!busy} className="btn-ghost text-[10px] border-[#8B1E1E] text-[#E8C547]">
              {busy === "end" ? "KOŃCZĘ…" : "NA PEWNO ZAKOŃCZYĆ?"}
            </button>
          ) : (
            <button onClick={() => setEnding(true)} className="btn-ghost text-[10px]">ZAKOŃCZ DOSTĘP</button>
          ))}
        </div>
      </div>
      {edit && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-[1fr_1fr_1.3fr_auto] items-end">
          <Num label={`Liczba spotkań (min. ${Math.max(1, p.sessions_used)})`} value={f.sessions_total} onChange={(v) => setF({ ...f, sessions_total: v })} min={Math.max(1, p.sessions_used)} />
          <Num label="Odstęp min. (dni)" value={f.min_gap_days} onChange={(v) => setF({ ...f, min_gap_days: v })} max={90} />
          <label className="block text-xs text-foreground/60 space-y-1">
            <span>Ważny do</span>
            <input type="date" className={inputCls} value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} />
          </label>
          <button onClick={() => run("save", () => bk("update_package", { package_id: p.id, ...f }))} disabled={!!busy} className="btn-relic text-[10px]">
            {busy === "save" ? "ZAPISUJĘ…" : "ZAPISZ"}
          </button>
        </div>
      )}
      {err && <p className="blood-text text-sm">{err}</p>}
    </div>
  );
}

export default function PackagesPanel() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(() => bk("packages").then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (err && !d) return <p className="blood-text text-sm">{err}</p>;
  if (!d) return <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />;

  const types = d.types || [];
  const rows = (d.packages || [])
    .filter((p) => all || statusOf(p)[0] === "aktywny")
    .filter((p) => !q || String(p.email || "").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      {types.length ? <Grant types={types} defaults={d.defaults} onDone={load} /> : <p className="text-sm text-foreground/50">Brak rodzajów spotkań z dostępem „pakiet”.</p>}
      <Defaults types={types} defaults={d.defaults} onSaved={(def) => setD((x) => ({ ...x, defaults: def }))} />
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <p className="technical text-[10px] gold-text">OSOBY Z DOSTĘPEM</p>
        <input placeholder="Szukaj e-maila" className={`${inputCls} max-w-[260px]`} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-foreground/60">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> pokaż też zakończone i wykorzystane
        </label>
      </div>
      {err && <p className="blood-text text-sm">{err}</p>}
      {!rows.length ? <p className="text-sm text-foreground/50">Brak osób{all ? "" : " z aktywnym dostępem"}.</p> : (
        <div className="space-y-3">{rows.map((p) => <Row key={p.id} p={p} onChanged={load} />)}</div>
      )}
    </div>
  );
}
