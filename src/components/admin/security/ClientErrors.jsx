import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Dziennik błędów stron (zapisywany przez Error Boundary).
export default function ClientErrors() {
  const { data, isLoading } = useQuery({
    queryKey: ["clientErrors"],
    queryFn: () => base44.entities.ClientError.filter({}, { sort: "-created_date", limit: 80 }).then((p) => p.items),
  });
  // Błędy z testów na komputerze (localhost / 127.0.0.1) i z robotów Google pomijamy (28.11.2026) — to nie problemy odwiedzających.
  const local = (e) => /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(String(e.url || "")) || /Googlebot/i.test(String(e.browser || ""));
  const rows = (data || []).filter((e) => !local(e)).slice(0, 50);
  const hidden = (data || []).length - rows.length;
  return (
    <section className="border hairline p-5">
      <p className="technical text-[10px] gold-text mb-4">DZIENNIK BŁĘDÓW STRON</p>
      {isLoading ? <p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p>
        : !rows.length ? <p className="text-sm text-foreground/50">Brak błędów u odwiedzających.{hidden ? ` Pominięto ${hidden} z testów lokalnych i robotów.` : ""}</p>
        : <ul className="space-y-3">{rows.map((e) => (
          <li key={e.id} className="text-sm border-b hairline pb-3">
            <p className="text-foreground/50 text-xs">{new Date(e.at || e.created_date).toLocaleString("pl-PL")} · <span className="break-all">{e.url}</span></p>
            <p className="blood-text break-words">{e.message}</p>
            <p className="text-foreground/40 text-xs break-words">{e.browser}</p>
          </li>))}</ul>}
    </section>
  );
}