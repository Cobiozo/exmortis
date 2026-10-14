import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Database, Download } from "lucide-react";

const mb = (b) => `${(Number(b || 0) / 1024 / 1024).toFixed(2)} MB`;
const when = (v) => (v ? String(v).slice(0, 16).replace("T", " ") : "—");

// Kopie zapasowe: lista, pobranie (podpisany link 5 minut) i wykonanie na żądanie.
export default function BackupsPanel() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () =>
    base44.functions
      .invoke("backupAdmin", { action: "list" })
      .then((r) => setItems(r.data.items || []))
      .catch(() => setItems([]));

  useEffect(() => { load(); }, []);

  const make = async () => {
    setBusy(true); setMsg(null);
    await base44.functions.invoke("backupAdmin", { action: "now" })
      .then((r) => { setMsg({ ok: true, text: `Gotowe: ${mb(r.data.size)} · ${r.data.rows} wierszy.` }); return load(); })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się zrobić kopii." }));
    setBusy(false);
  };

  const download = async (id) => {
    setMsg(null);
    await base44.functions.invoke("backupAdmin", { action: "download", id })
      .then((r) => { window.location.href = r.data.url; })
      .catch((e) => setMsg({ ok: false, text: e?.response?.data?.error || "Nie udało się pobrać kopii." }));
  };

  return (
    <section className="border hairline p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Database className="h-5 w-5 gold-text" />
        <h2 className="relic-heading text-xl">Kopie zapasowe</h2>
      </div>
      <p className="text-sm text-foreground/50 mb-6">
        Raz w tygodniu (niedziela ok. 3:30) powstaje kopia najważniejszych danych — zamówienia, zwroty,
        zapisy, produkty, biblioteka i rezerwacje. Zostaje 8 najnowszych. Kopie są plikami prywatnymi:
        pobranie tworzy link ważny 5 minut i zapisuje wpis w logu bezpieczeństwa.
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button onClick={make} disabled={busy} className="btn-relic">
          {busy ? "ROBIĘ KOPIĘ…" : "ZRÓB KOPIĘ TERAZ"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "gold-text" : "blood-text"}`}>{msg.text}</span>}
      </div>

      {items === null ? (
        <p className="technical text-[10px] text-foreground/40">WCZYTUJĘ…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-foreground/50">Nie ma jeszcze żadnej kopii.</p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/40">
          {items.map((b) => (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3">
              <span className="flex-1 min-w-0">
                <span className="block font-mono text-xs text-foreground/80">{when(b.created_at)}</span>
                <span className="block text-xs text-foreground/50 mt-1">
                  {b.status === "blad"
                    ? `Nie udało się: ${b.blad || "błąd"}`
                    : `${mb(b.size)} · ${b.rows} wierszy · ${b.tables.length} tabel · ${b.format}`}
                  {b.kto ? ` · ${b.kto}` : ""}
                </span>
              </span>
              {b.status === "gotowa" && (
                <button onClick={() => download(b.id)} className="btn-ghost px-4 py-2">
                  <Download className="h-4 w-4" /> POBIERZ
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}