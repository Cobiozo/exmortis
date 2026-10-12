import React from "react";
import { base44 } from "@/api/base44Client";

// Wywołania funkcji rozdrozaAdmin (błąd z raportem walidacji, jeśli serwer go zwrócił).
export const rz = (action, p = {}) => base44.functions.invoke("rozdrozaAdmin", { action, ...p })
  .then((r) => r.data)
  .catch((e) => { const err = new Error(e?.response?.data?.error || "Nie udało się."); err.report = e?.response?.data?.report; throw err; });


export const statusBadge = (s) => s.status === "published"
  ? <span className={`technical text-[9px] px-2 py-1 border ${s.changed ? "border-[#E8C547]/60 text-[#E8C547]" : "border-[#9FD3A0]/50 text-[#9FD3A0]"}`}>{s.changed ? `OPUBLIKOWANA v${s.version} · ZMIANY CZEKAJĄ` : `OPUBLIKOWANA v${s.version}`}</span>
  : <span className="technical text-[9px] px-2 py-1 border hairline text-foreground/55">SZKIC</span>;

