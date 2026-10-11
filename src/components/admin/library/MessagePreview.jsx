import React from "react";
import { Loader2 } from "lucide-react";

// Podgląd „tak zobaczy to [osoba]" — liczony na serwerze, tą samą ścieżką co u klienta.
export default function MessagePreview({ data, email, onPick, busy }) {
  if (busy) return <Loader2 className="h-4 w-4 animate-spin gold-text" />;
  if (!data || !data.html) return <p className="text-sm text-foreground/45">Wybierz odbiorców, aby zobaczyć podgląd.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="technical text-[10px] text-foreground/50">TAK ZOBACZY TO</label>
        <select value={email || ""} onChange={(e) => onPick(e.target.value)}
          className="bg-[#0A0A0B] border hairline px-2 py-1 text-xs focus:border-[#C9A24A] outline-none max-w-full">
          {(data.emails || []).map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-xs text-foreground/45">
          {data.imie ? `wstawione imię: ${data.imie}` : "bez imienia — zdanie dopasowane"}
        </span>
      </div>

      <div className="border hairline bg-[#0F0F10] p-4 space-y-4">
        <p className="technical text-[10px] gold-text">EXMORTIS</p>
        <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: data.html }} />
        <div className="border-t hairline pt-3 space-y-1 text-xs text-foreground/50">
          <p>{data.stopka?.reply}</p>
          {data.stopka?.whatsapp && <p>WhatsApp: {data.stopka.whatsapp}</p>}
          <p>{data.stopka?.crisis}</p>
        </div>
      </div>
    </div>
  );
}