import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fallbackFresh } from "@/content/joinFallback";
import { STALE_TEXT } from "./FallbackBadge";

// Pulpit: spotkania online, których wbudowana kopia awaryjna jest nieaktualna.
export default function FallbackWarning() {
  const [stale, setStale] = useState([]);
  useEffect(() => {
    base44.functions.invoke("eventsAdmin", { action: "list" })
      .then((r) => setStale((r.data.events || []).filter((e) => fallbackFresh(e) === false)))
      .catch(() => {});
  }, []);
  if (!stale.length) return null;
  return (
    <div className="border border-[#C9A24A] p-5 mb-8 space-y-2">
      {stale.map((e) => (
        <p key={e.id} className="flex items-start gap-3 text-sm">
          <AlertTriangle className="h-4 w-4 gold-text shrink-0 mt-0.5" />
          <span>„{e.title}”: {STALE_TEXT}. <Link to="/admin/spotkania" className="gold-text underline">Spotkania</Link></span>
        </p>
      ))}
    </div>
  );
}