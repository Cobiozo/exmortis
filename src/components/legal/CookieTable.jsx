import React from "react";

export default function CookieTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-foreground/70 border hairline">
        <thead><tr className="text-left gold-text">{["Nazwa", "Dostawca", "Kategoria", "Cel", "Okres"].map((h) => <th key={h} className="p-2 border-b hairline">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, j) => <tr key={j}>{r.map((c, i) => <td key={i} className="p-2 border-b hairline align-top">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}