import React, { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { useFixedZoom, saveFixedZoom } from "@/components/admin/zoom/fixedZoom";

const cls = "w-full min-h-[48px] bg-transparent border hairline px-4 py-3 text-base text-foreground focus:border-[#C9A24A] focus:outline-none";

// Ustawienia strony → Mój stały link Zoom. Potem przy spotkaniu i rodzaju konsultacji wybierasz: stały albo inny link.
export default function ZoomFixedSettings() {
  const z = useFixedZoom();
  const [link, setLink] = useState("");
  const [haslo, setHaslo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (z) { setLink(z.link); setHaslo(z.haslo); } }, [z]);
  if (!z) return null;
  const dirty = link.trim() !== z.link || haslo.trim() !== z.haslo;
  const notZoom = link.trim() && !/^https:\/\/([a-z0-9-]+\.)*zoom\.us\//i.test(link.trim());
  const save = async () => {
    setBusy(true); setMsg("");
    try { await saveFixedZoom(link.trim(), haslo.trim()); setMsg(link.trim() ? "Zapisano." : "Usunięto stały link."); }
    catch (e) { setMsg(e?.response?.data?.error || "Nie udało się zapisać."); }
    setBusy(false);
  };
  return (
    <section className="border hairline p-6 md:p-8 space-y-5">
      <div className="flex items-start gap-3">
        <Video className="h-5 w-5 gold-text mt-1 shrink-0" />
        <div>
          <h2 className="relic-heading text-xl">Mój stały link Zoom</h2>
          <p className="text-sm text-foreground/50 mt-1">Twój osobisty pokój. Przy spotkaniu i przy rodzaju konsultacji 1:1 wybierasz potem jednym kliknięciem: „Mój stały link” albo „Inny link”. Zmiana tutaj nie zmienia linków już zapisanych w spotkaniach.</p>
        </div>
      </div>
      <div className="grid md:grid-cols-[1fr_220px] gap-4">
        <label className="block min-w-0">
          <span className="technical text-[10px] text-foreground/55 block mb-2">LINK (NAJLEPIEJ Z WBUDOWANYM HASŁEM)</span>
          <input type="url" inputMode="url" className={cls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://us06web.zoom.us/j/…?pwd=…" />
        </label>
        <label className="block min-w-0">
          <span className="technical text-[10px] text-foreground/55 block mb-2">HASŁO (OPCJONALNIE)</span>
          <input className={cls} value={haslo} onChange={(e) => setHaslo(e.target.value)} />
        </label>
      </div>
      {notZoom && <p className="text-sm text-[#E8676A]">To nie wygląda na link do Zoom — sprawdź, czy to na pewno ten adres.</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button onClick={save} disabled={busy || !dirty} className="btn-relic disabled:opacity-50">{busy ? "ZAPISUJĘ…" : "ZAPISZ LINK"}</button>
        {msg && <span className="text-sm text-foreground/70">{msg}</span>}
      </div>
    </section>
  );
}
