import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, Loader2, Mail, UserRound } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { FilterChips, SearchField } from "@/components/admin/ui/kit";

// Skrzynka (28.11.2026): wiadomości z formularza Kontakt — treść, statusy, notatka, odpowiedź z Twojej poczty.
// Pilne i nowe na górze. Odpowiedź otwiera Twój program pocztowy z adresem i tematem (nic nie wychodzi z panelu).
const STATUSES = [
  ["nowa", "Nowe"],
  ["w_toku", "W toku"],
  ["odpowiedziana", "Odpowiedziane"],
  ["zamknieta", "Zamknięte"],
];
const LABEL = Object.fromEntries(STATUSES);
const TONE = {
  nowa: "border-[#C9A24A] gold-text bg-[#C9A24A]/10",
  w_toku: "border-sky-400/50 text-sky-300",
  odpowiedziana: "border-emerald-500/40 text-emerald-400",
  zamknieta: "hairline text-foreground/50",
};
const when = (d) => new Date(d).toLocaleString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
const reply = (m) => `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: Twoja wiadomość — exmortis")}&body=${encodeURIComponent(`\n\n—\nW odpowiedzi na wiadomość z ${when(m.created_date)}:\n> ${String(m.message || "").split("\n").join("\n> ")}`)}`;

function Message({ m, open, onToggle, onSave }) {
  const [note, setNote] = useState(m.notatka || "");
  const [busy, setBusy] = useState(false);
  const save = async (patch) => { setBusy(true); try { await onSave(m, patch); } finally { setBusy(false); } };
  return (
    <li className={`border hairline ${m.status === "nowa" ? "bg-[#C9A24A]/[0.04]" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02]">
        <Mail className={`h-4 w-4 mt-1 shrink-0 ${m.status === "nowa" ? "gold-text" : "text-foreground/40"}`} />
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className={`text-sm ${m.status === "nowa" ? "font-semibold text-foreground" : "text-foreground/85"}`}>{m.name || "Bez imienia"}</span>
            <span className="text-xs text-foreground/50 [overflow-wrap:anywhere]">{m.email}</span>
            {m.pilne && <span className="inline-flex items-center gap-1 text-[11px] text-[#E8C547] border border-[#E8C547]/50 px-1.5"><AlertTriangle className="h-3 w-3" /> PILNE</span>}
            {m.test && <span className="text-[11px] text-foreground/45 border hairline px-1.5">TEST</span>}
          </span>
          <span className={`block text-sm mt-1 ${open ? "whitespace-pre-line text-foreground/85" : "line-clamp-2 text-foreground/60"}`}>{m.message}</span>
          <span className="block text-xs text-foreground/40 mt-1">{when(m.created_date)}{m.count_from > 1 ? ` · ${m.count_from} wiadomości od tej osoby` : ""}</span>
        </span>
        <span className={`shrink-0 border px-2 py-0.5 text-[11px] ${TONE[m.status] || TONE.nowa}`}>{LABEL[m.status] || m.status}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t hairline p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <a href={reply(m)} onClick={() => m.status === "nowa" && save({ status: "w_toku" })} className="btn-relic !py-2 !px-4 text-[11px]">Odpowiedz z poczty</a>
            {STATUSES.filter(([k]) => k !== m.status).map(([k, l]) => (
              <button key={k} type="button" disabled={busy} onClick={() => save({ status: k })} className="btn-ghost !py-2 !px-3 text-[11px] disabled:opacity-40">Oznacz: {l.toLowerCase()}</button>
            ))}
            <Link to={`/admin/klienci?email=${encodeURIComponent(m.email)}`} className="btn-ghost !py-2 !px-3 text-[11px]"><UserRound className="h-3.5 w-3.5" /> Karta osoby</Link>
          </div>
          <label className="block text-xs text-foreground/50">
            Notatka (widzisz tylko Ty)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (m.notatka || "") && save({ notatka: note })} rows={2}
              className="mt-1 w-full bg-[#0A0A0B] border hairline px-3 py-2 text-sm focus:border-[#C9A24A] focus:outline-none" placeholder="Np. odpisałem 28.11, czekam na termin" />
          </label>
        </div>
      )}
    </li>
  );
}

export default function InboxPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("aktywne");
  const [q, setQ] = useState(() => { try { return new URLSearchParams(window.location.search).get("q") || ""; } catch { return ""; } });
  const [open, setOpen] = useState(null);
  const load = () => base44.functions.invoke("adminDashboard", { action: "inbox" })
    .then((r) => setRows(r.data.messages || [])).catch((e) => { setErr(e?.response?.data?.error || "Nie udało się wczytać wiadomości."); setRows([]); });
  useEffect(() => { load(); }, []);

  const save = async (m, patch) => {
    setRows((l) => l.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    try { await base44.functions.invoke("adminDashboard", { action: "inbox_update", id: m.id, ...patch }); }
    catch { setErr("Nie udało się zapisać zmiany."); load(); }
  };

  const counts = useMemo(() => {
    const c = { aktywne: 0, wszystkie: (rows || []).length };
    for (const r of rows || []) { c[r.status] = (c[r.status] || 0) + 1; if (r.status === "nowa" || r.status === "w_toku") c.aktywne++; }
    return c;
  }, [rows]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows || []).filter((r) => (tab === "wszystkie" || (tab === "aktywne" ? ["nowa", "w_toku"].includes(r.status) : r.status === tab))
      && (!s || [r.name, r.email, r.message].some((x) => String(x || "").toLowerCase().includes(s))));
  }, [rows, tab, q]);

  if (rows === null) return <p className="flex items-center gap-2 text-sm text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Ładuję wiadomości…</p>;
  const TABS = [["aktywne", "Do obsłużenia"], ...STATUSES.filter(([k]) => k !== "nowa"), ["wszystkie", "Wszystkie"]];
  return (
    <div className="space-y-5">
      <p className="text-sm text-foreground/60 max-w-2xl">
        Wiadomości z formularza na stronie Kontakt. O każdej nowej dostajesz mail (bez treści — treść czytasz tutaj).
        „Odpowiedz z poczty” otwiera Twój program pocztowy z adresem i tematem.
      </p>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips items={TABS.map(([k, l]) => [k, l, k === "aktywne" ? counts.aktywne : k === "wszystkie" ? counts.wszystkie : counts[k] || 0])} value={tab} onChange={setTab} label="Status wiadomości" />
        <SearchField value={q} onChange={setQ} placeholder="Imię, e-mail albo treść" label="Szukaj w wiadomościach" className="lg:w-72" />
      </div>
      {err && <p className="text-sm text-[#E8C547]" role="alert">{err}</p>}
      {!shown.length ? (
        <p className="border hairline p-8 text-center text-sm text-foreground/50">
          {rows.length ? "Nic nie pasuje do wyboru." : "Na razie nikt nie napisał przez formularz. Gdy przyjdzie wiadomość, dostaniesz mail i zobaczysz ją tutaj."}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((m) => <Message key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} onSave={save} />)}
        </ul>
      )}
    </div>
  );
}
