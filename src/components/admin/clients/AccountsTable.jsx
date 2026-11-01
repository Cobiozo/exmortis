import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fmtDay, fmtAgo } from "./accountsUtils";

const ROLE_CLS = { admin: "gold-text border-[#C9A24A]/60", techniczna: "text-foreground/75 border-[#3D3D3F]", klient: "text-foreground/55 border-[#3D3D3F]" };

const Role = ({ role }) => (
  <span className={`inline-block border px-2 py-0.5 technical text-[9px] ${ROLE_CLS[role] || ROLE_CLS.klient}`}>{role}</span>
);

const Status = ({ a }) => (
  <span className={`technical text-[9px] ${a.blocked ? "blood-text" : "text-foreground/55"}`}>{a.blocked ? "zablokowane" : "aktywne"}</span>
);

// Tabela kont (desktop). Telefon ma osobny układ kart — bez przewijania strony w bok.
export default function AccountsTable({ rows, sort, onSort, onPick }) {
  const Th = ({ k, children, right }) => (
    <th className={`px-3 py-3 technical text-[9px] text-foreground/45 font-normal ${right ? "text-right" : "text-left"}`}>
      <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:gold-text">
        {children}{sort.key === k ? (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </button>
    </th>
  );

  return (
    <div className="border hairline overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b hairline">
          <tr>
            <Th k="name">Imię i e-mail</Th>
            <Th k="role">Rola</Th>
            <Th k="created_at">Założone</Th>
            <Th k="last_sign_in_at">Ostatnie logowanie</Th>
            <Th k="email_confirmed">Potwierdzony</Th>
            <Th k="provider">Logowanie przez</Th>
            <Th k="accesses" right>Dostępy</Th>
            <Th k="blocked">Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3D3D3F]/60">
          {rows.map((a) => (
            <tr key={a.id} onClick={() => onPick(a.email)} className="cursor-pointer hover:bg-[#0F0F10]">
              <td className="px-3 py-3">
                <p className="truncate max-w-[260px]">{a.name || "—"}</p>
                <p className="text-xs text-foreground/45 truncate max-w-[260px]">{a.email}</p>
              </td>
              <td className="px-3 py-3"><Role role={a.role} /></td>
              <td className="px-3 py-3 text-foreground/70">{fmtDay(a.created_at)}</td>
              <td className="px-3 py-3 text-foreground/70">
                {fmtDay(a.last_sign_in_at)}<span className="block text-xs text-foreground/40">{fmtAgo(a.last_sign_in_at)}</span>
              </td>
              <td className="px-3 py-3">{a.email_confirmed ? "tak" : <span className="text-foreground/45">nie</span>}</td>
              <td className="px-3 py-3 text-foreground/70">{a.provider}</td>
              <td className="px-3 py-3 text-right">{a.accesses}</td>
              <td className="px-3 py-3"><Status a={a} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}