import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Dziennik błędów stron (zapisywany przez Error Boundary).
export default function ClientErrors() {
  const { data, isLoading } = useQuery({
    queryKey: ["clientErrors"],
    queryFn: () => base44.entities.ClientError.filter({}, { sort: "-created_date", limit: 50 }).then((p) => p.items),
  });
  return (
    <section className="border hairline p-5">
      <p className="technical text-[10px] gold-text mb-4">DZIENNIK BŁĘDÓW STRON</p>
      {isLoading ? <p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p>
        : !data?.length ? <p className="text-sm text-foreground/50">Brak błędów.</p>
        : <ul className="space-y-3">{data.map((e) => (
          <li key={e.id} className="text-sm border-b hairline pb-3">
            <p className="text-foreground/50 text-xs">{new Date(e.at || e.created_date).toLocaleString("pl-PL")} · <span className="break-all">{e.url}</span></p>
            <p className="blood-text break-words">{e.message}</p>
            <p className="text-foreground/40 text-xs break-words">{e.browser}</p>
          </li>))}</ul>}
    </section>
  );
}