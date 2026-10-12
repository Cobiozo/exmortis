import React, { useEffect, useState } from "react";
import { logAccess } from "@/lib/auditLog";
import { Download } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DOMINANTS = ["Mentalna", "Duchowa", "Życiowa", "Mieszana", "Żadna"];
const STAGES = ["Śmierć", "Próg", "Powrót", "Inny"];
const FORMS = ["Mężczyzna", "Kobieta"];

const selectCls =
  "bg-[#0F0F10] border hairline text-foreground/60 text-xs px-3 py-2 focus:border-[#C9A24A] focus:outline-none transition-colors";

// Wyniki testu „Która śmierć jest Twoja?" — liczniki, filtry, tabela, eksport CSV.
export default function QuizStatsPanel() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    dominant: "",
    stage: "",
    form_of_address: "",
    source: "",
    date_from: "",
    date_to: "",
  });
  const [applied, setApplied] = useState(filter);

  useEffect(() => {
    base44.functions
      .invoke("adminQuiz", { action: "stats" })
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    base44.functions
      .invoke("adminQuiz", { action: "list", ...applied })
      .then((res) => setRows(res.data.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [applied]);

  const apply = (e) => {
    e.preventDefault();
    setApplied(filter);
  };

  const countOf = (list, key, value) =>
    (list.find((c) => c[key] === value) || { count: 0 }).count;

  const csvCell = (v) => `"${String(v === null || v === undefined ? "" : v).replace(/"/g, '""')}"`;

  const exportCsv = () => {
    logAccess("eksport", "Wyniki testu (CSV)");
    const header = [
      "data", "imię", "e-mail", "forma", "mentalna", "duchowa", "życiowa",
      "skala (max)", "dominanta", "etap", "źródło", "newsletter", "odpowiedź otwarta",
    ];
    const lines = rows.map((r) =>
      [
        r.created_at, r.first_name, r.email, r.form_of_address,
        r.score_mental, r.score_spiritual, r.score_life, r.score_max || 12,
        r.dominant, r.stage, r.source, r.newsletter_consent ? "tak" : "nie", r.open_answer,
      ].map(csvCell).join(";")
    );
    const csv = "\uFEFF" + [header.map(csvCell).join(";"), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "wyniki-testu-exmortis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <p className="technical text-[10px] text-foreground/40 mb-8">
        WYNIKI TESTU · {stats ? `${stats.total} ${stats.total === 1 ? "WYNIK" : "WYNIKÓW"}` : "…"}
      </p>

      {/* Liczniki */}
      {stats && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {DOMINANTS.map((t) => (
              <div key={t} className="border hairline p-5">
                <p className="shop-heading text-3xl gold-text">{countOf(stats.dominant, "dominant", t)}</p>
                <p className="technical text-[9px] text-foreground/40 mt-2">{t.toUpperCase()}</p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {STAGES.map((s) => (
              <div key={s} className="border hairline p-5">
                <p className="shop-heading text-3xl text-[#F5EFE1]">{countOf(stats.stages, "stage", s)}</p>
                <p className="technical text-[9px] text-foreground/40 mt-2">ETAP: {s.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Filtry */}
      <form onSubmit={apply} className="flex flex-wrap gap-3 items-end mb-8">
        <select value={filter.dominant} onChange={(e) => setFilter({ ...filter, dominant: e.target.value })} className={selectCls}>
          <option value="">Śmierć — wszystkie</option>
          {DOMINANTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filter.stage} onChange={(e) => setFilter({ ...filter, stage: e.target.value })} className={selectCls}>
          <option value="">Etap — wszystkie</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.form_of_address} onChange={(e) => setFilter({ ...filter, form_of_address: e.target.value })} className={selectCls}>
          <option value="">Forma — wszystkie</option>
          {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          placeholder="Źródło (np. ig, fb)"
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value })}
          className={`${selectCls} w-40`}
        />
        <input
          type="date"
          value={filter.date_from}
          onChange={(e) => setFilter({ ...filter, date_from: e.target.value })}
          className={selectCls}
        />
        <input
          type="date"
          value={filter.date_to}
          onChange={(e) => setFilter({ ...filter, date_to: e.target.value })}
          className={selectCls}
        />
        <button type="submit" className="btn-ghost !px-5 !py-2 text-[10px]">FILTRUJ</button>
        <button type="button" onClick={() => { const empty = { dominant: "", stage: "", form_of_address: "", source: "", date_from: "", date_to: "" }; setFilter(empty); setApplied(empty); }} className="technical text-[9px] text-foreground/40 hover:text-foreground/70 px-2 py-2">
          WYCZYŚĆ
        </button>
      </form>

      {/* Tabela */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 border hairline animate-pulse bg-[#0F0F10]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-foreground/50 border hairline p-10 text-center">
          Brak wyników dla wybranych filtrów.
        </p>
      ) : (
        <div className="border hairline">
          <div className="flex justify-end p-3 border-b hairline">
            <button onClick={exportCsv} className="technical text-[9px] text-foreground/50 hover:text-[#C9A24A] flex items-center gap-2 transition-colors">
              <Download className="h-3 w-3" /> EKSPORT CSV
            </button>
          </div>
          <div className="divide-y divide-[#3D3D3F]/40">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-4 hover:bg-[#0F0F10] transition-colors">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="text-xs text-foreground/30 w-36">
                    {String(r.created_at || "").slice(0, 16)}
                  </span>
                  <span className="text-foreground/70">{r.first_name || "—"}</span>
                  <span className="text-foreground/40 text-xs">{r.email}</span>
                  <span className="technical text-[9px] text-foreground/40">
                    {r.form_of_address === "Kobieta" ? "K" : "M"}
                  </span>
                  <span className="technical text-[9px] text-foreground/40">
                    M {r.score_mental} · D {r.score_spiritual} · Ż {r.score_life} /{r.score_max || 12}
                  </span>
                  <span className="technical text-[9px] gold-text">{(r.dominant || "").toUpperCase()}</span>
                  <span className="technical text-[9px] text-[#F5EFE1]/60">ETAP: {r.stage || "—"}</span>
                  {r.source && (
                    <span className="technical text-[9px] text-foreground/40">ŹRÓDŁO: {r.source}</span>
                  )}
                  {r.newsletter_consent && (
                    <span className="technical text-[9px] text-[#C9A24A]">LISTY</span>
                  )}
                </div>
                {r.open_answer && (
                  <p className="mt-3 pl-4 border-l border-[#5C1A1B] text-sm text-[#F5EFE1]/70 italic leading-relaxed whitespace-pre-wrap">
                    „Ostatnio umarło we mnie… {r.open_answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}