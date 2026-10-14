import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Check, AlertTriangle, X, ArrowRight } from "lucide-react";

// Pulpit: lista kontrolna „co jeszcze trzeba ustawić”, żeby sprzedaż, maile i spotkania działały.
// Serwer zwraca wyłącznie wartości tak/nie — nigdy treści kluczy ani haseł.
const DOT = { ok: "bg-[#4E8A5F]", warn: "bg-[#C9A24A]", err: "bg-[#BC1E22]" };
const TXT = { ok: "text-[#7FB08C]", warn: "gold-text", err: "blood-text" };
const ICON = { ok: Check, warn: AlertTriangle, err: X };
const LABEL = { ok: "GOTOWE", warn: "DO POPRAWY", err: "BLOKUJE" };

export default function ReadinessCard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("adminDashboard", { action: "readiness" })
      .then((r) => setD(r.data))
      .catch(() => setD(null));
  }, []);

  if (!d?.items?.length) return null;

  return (
    <div className="border hairline bg-[#0F0F10] mb-8">
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b hairline">
        <p className="technical text-[10px] gold-text">GOTOWOŚĆ PLATFORMY</p>
        <p className="technical text-[10px] text-foreground/50">
          {d.ok} / {d.total} GOTOWE
        </p>
      </div>
      <div className="divide-y divide-[#3D3D3F]/40">
        {d.items.map((i) => {
          const Icon = ICON[i.status] || AlertTriangle;
          return (
            <Link
              key={i.id}
              to={i.to}
              className="flex items-start gap-4 px-5 py-4 hover:bg-[#0A0A0B] transition-colors"
            >
              <span className={`mt-0.5 h-5 w-5 flex items-center justify-center shrink-0 ${DOT[i.status] || DOT.warn}`}>
                <Icon className="h-3 w-3 text-[#0A0A0B]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm">{i.title}</span>
                  <span className={`technical text-[9px] ${TXT[i.status] || TXT.warn}`}>{LABEL[i.status] || ""}</span>
                </span>
                <span className="block text-xs text-foreground/55 mt-1">{i.detail}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-foreground/30 shrink-0 mt-1" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}