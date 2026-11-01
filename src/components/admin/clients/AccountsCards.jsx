import React from "react";
import { fmtDay, fmtAgo } from "./accountsUtils";

const Field = ({ label, children }) => (
  <div>
    <p className="technical text-[9px] text-foreground/40 mb-1">{label}</p>
    <p className="text-sm text-foreground/70">{children}</p>
  </div>
);

// Układ kart na telefonie — te same dane co tabela, bez poziomego przewijania.
export default function AccountsCards({ rows, onPick }) {
  return (
    <div className="space-y-3">
      {rows.map((a) => (
        <button key={a.id} onClick={() => onPick(a.email)} className="w-full text-left border hairline p-4 space-y-3 hover:border-[#C9A24A]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate">{a.name || "—"}</p>
              <p className="text-xs text-foreground/45 truncate">{a.email}</p>
            </div>
            <span className={`technical text-[9px] shrink-0 ${a.role === "admin" ? "gold-text" : "text-foreground/55"}`}>{a.role}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Założone">{fmtDay(a.created_at)}</Field>
            <Field label="Ostatnie logowanie">{fmtDay(a.last_sign_in_at)}<span className="block text-xs text-foreground/40">{fmtAgo(a.last_sign_in_at)}</span></Field>
            <Field label="Logowanie przez">{a.provider}</Field>
            <Field label="E-mail potwierdzony">{a.email_confirmed ? "tak" : "nie"}</Field>
            <Field label="Dostępy">{a.accesses}</Field>
            <Field label="Status"><span className={a.blocked ? "blood-text" : ""}>{a.blocked ? "zablokowane" : "aktywne"}</span></Field>
          </div>
        </button>
      ))}
    </div>
  );
}