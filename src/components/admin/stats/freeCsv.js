// Eksport tabeli darmowych materiałów do CSV (średnik + BOM, jak w innych panelach).
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "");

export function downloadFreeCsv(products) {
  const head = ["Materiał", "Typ", "7 dni", "30 dni", "Razem", "E-maile", "Listy powrotu", "PDF z maila", "Ostatnie zamówienie"];
  const lines = products.map((p) => [
    p.name,
    p.type,
    p.d7,
    p.d30,
    p.total,
    p.emails,
    `${pct(p.emails_news, p.emails)} (${p.emails_news}/${p.emails})`,
    p.pdf,
    p.last_at ? new Date(p.last_at).toLocaleString("pl-PL") : "",
  ]);
  const csv = "\ufeff" + [head, ...lines]
    .map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `darmowe-materialy-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}