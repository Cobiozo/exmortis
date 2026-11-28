import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { logAccess } from "@/lib/auditLog";
import ClientDetail from "./ClientDetail";
import AccountsToolbar from "./AccountsToolbar";
import AccountsTable from "./AccountsTable";
import AccountsCards from "./AccountsCards";
import { accountsCsv, matchesFilter, matchesQuery, sortRows } from "./accountsUtils";

// Zakładka KONTA: zarejestrowane konta, ostatnie logowania, dostępy i status.
export default function AccountsTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState({ key: "created_at", dir: "desc" });
  // ?email=… (ze Skrzynki, zamówień itd.) otwiera od razu kartę osoby.
  const [picked, setPicked] = useState(() => { try { return new URLSearchParams(window.location.search).get("email") || null; } catch { return null; } });
  // Konta testowe (adresy Dawida z aliasami itd.) domyślnie ukryte — 28.11.2026.
  const [showTest, setShowTest] = useState(false);

  const load = () =>
    base44.functions
      .invoke("adminClients", { action: "accounts" })
      .then((r) => { setData(r.data); setErr(""); })
      .catch((e) => { setErr(e.message || "Nie udało się pobrać kont"); setData({ accounts: [], counts: null }); });

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return sortRows(data.accounts.filter((a) => (showTest || !a.test) && matchesFilter(a, filter) && matchesQuery(a, q)), sort.key, sort.dir)
      .map((a) => (a.test ? { ...a, role: `${a.role} · test` } : a));
  }, [data, filter, q, sort, showTest]);

  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));

  const exportCsv = () => {
    logAccess("eksport", "Konta (CSV)", rows.length);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([accountsCsv(rows)], { type: "text/csv" }));
    a.download = "konta-exmortis.csv";
    a.click();
  };

  if (picked) {
    return (
      <div className="space-y-6">
        <button onClick={() => setPicked(null)} className="inline-flex items-center gap-2 technical text-[10px] text-foreground/55 hover:gold-text">
          <ArrowLeft className="h-4 w-4" /> WRÓĆ DO KONT
        </button>
        <ClientDetail key={picked} email={picked} onChange={load} />
      </div>
    );
  }

  if (!data) return <Loader2 className="h-5 w-5 animate-spin gold-text" />;

  return (
    <div className="space-y-6">
      <AccountsToolbar q={q} onQ={setQ} filter={filter} onFilter={setFilter} counts={data.counts} shown={rows.length} onExport={exportCsv} />
      {data.counts?.tests > 0 && (
        <label className="flex items-center gap-2 text-xs text-foreground/60 cursor-pointer">
          <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} className="accent-[#C9A24A]" />
          Pokaż konta testowe ({data.counts.tests}) — Twoje adresy z „+…” i adresy z listy testowej
        </label>
      )}
      {err ? <p className="text-sm blood-text">{err}</p> : rows.length === 0 ? (
        <p className="text-sm text-foreground/50">Brak kont spełniających te warunki.</p>
      ) : (
        <>
          <div className="hidden md:block"><AccountsTable rows={rows} sort={sort} onSort={onSort} onPick={setPicked} /></div>
          <div className="md:hidden"><AccountsCards rows={rows} onPick={setPicked} /></div>
        </>
      )}
    </div>
  );
}