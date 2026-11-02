import React from "react";

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const date = (v) => (v ? new Date(v).toLocaleDateString("pl-PL") : "—");

export default function FreeMaterialsTable({ products = [] }) {
  if (!products.length) return <p className="text-sm text-foreground/55">Jeszcze żadnego darmowego materiału.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="border-b hairline">
            {["Materiał", "7 dni", "30 dni", "Razem", "E-maile", "Listy powrotu", "PDF z maila", "Ostatnie"].map((h, i) => (
              <th key={h} className={`technical text-[9px] text-foreground/55 pb-3 ${i ? "text-right" : "text-left"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.name} className="border-b hairline">
              <td className="py-3 pr-4">
                <span className="text-foreground/85">{p.name}</span>
                <span className="technical text-[9px] text-foreground/40"> · {p.type || "—"}</span>
              </td>
              <td className="text-right technical text-[10px] text-foreground/70">{p.d7}</td>
              <td className="text-right technical text-[10px] text-foreground/70">{p.d30}</td>
              <td className="text-right technical text-[10px] text-[#F5EFE1]">{p.total}</td>
              <td className="text-right technical text-[10px] text-foreground/70">{p.emails}</td>
              <td className="text-right technical text-[10px] text-foreground/70">{pct(p.emails_news, p.emails)}</td>
              <td className="text-right technical text-[10px] text-foreground/70">{p.pdf}</td>
              <td className="text-right technical text-[10px] text-foreground/55">{date(p.last_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}