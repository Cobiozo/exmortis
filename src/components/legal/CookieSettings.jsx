import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { readConsent } from "./cookieStore";

export default function CookieSettings({ onSave }) {
  const prev = readConsent();
  const [a, setA] = useState(prev?.analytics || false);
  const [m, setM] = useState(prev?.marketing || false);
  const Row = ({ title, desc, children }) => (
    <div className="flex items-start justify-between gap-4 py-3 border-b hairline">
      <div><p className="text-sm text-foreground/85">{title}</p><p className="text-xs text-foreground/50">{desc}</p></div>{children}
    </div>
  );
  return (
    <div>
      <Row title="Niezbędne" desc="Logowanie i sesja, bezpieczeństwo, koszyk/płatność, zapamiętanie wyboru cookies, ustawienia Minutnika ciszy."><span className="technical text-[10px] gold-text">ZAWSZE</span></Row>
      <Row title="Analityczne" desc="Statystyki odwiedzin (jeśli używamy)."><Switch checked={a} onCheckedChange={setA} aria-label="Analityczne" /></Row>
      <Row title="Marketingowe" desc="Piksel Meta (Facebook/Instagram) — pomiar skuteczności reklam."><Switch checked={m} onCheckedChange={setM} aria-label="Marketingowe" /></Row>
      <button onClick={() => onSave(a, m)} className="btn-ghost !px-4 !py-2 text-[10px] mt-4">Zapisz wybór</button>
    </div>
  );
}