import React, { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { obok } from "./obokApi";

// Konto → Obok: powiadomienia e-mail dla każdej serii i „Opuść serię”.
export default function ObokNotifications() {
  const [tiles, setTiles] = useState([]);
  const load = () => obok("home").then((d) => setTiles((d?.tiles || []).filter((t) => t.member))).catch(() => {}); // błąd sieci = brak sekcji, bez wyjątku
  useEffect(() => { load(); }, []);
  if (!tiles.length) return null;
  return (
    <div className="max-w-xl">
      <p className="technical text-[10px] gold-text mb-6">POWIADOMIENIA</p>
      {tiles.map((t) => (
        <div key={t.id} className="flex items-center gap-4 py-4 border-b hairline">
          <span className="flex-1 text-[#F5EFE1]">{t.nazwa}</span>
          <Switch checked={t.powiadomienia} onCheckedChange={(on) => obok("notify", { seria_id: t.id, on }).then(load)} aria-label={`E-maile: ${t.nazwa}`} />
          <button onClick={() => window.confirm(`Opuścić serię „${t.nazwa}”? Twój postęp zostanie usunięty.`) && obok("leave", { seria_id: t.id }).then(load)} className="technical text-[10px] text-foreground/45 hover:blood-text">OPUŚĆ</button>
        </div>
      ))}
    </div>
  );
}