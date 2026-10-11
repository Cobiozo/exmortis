import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { lib, inputCls } from "./libApi";
import TriSwitch from "./TriSwitch";
import LibModal from "./LibModal";

// Karta w Ustawieniach: dwa przełączniki, e-mail o materiałach, WhatsApp, próg przestrzeni.
export default function LibrarySettingsPanel() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { lib("settings").then((d) => setS(d.settings)).catch(() => setErr("Nie udało się wczytać ustawień.")); }, []);
  if (!s) return <p className="technical text-[10px] text-foreground/40">{err || "WCZYTUJĘ…"}</p>;

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));

  const save = async (next) => {
    setBusy(true); setErr(""); setSaved("");
    try {
      await lib("save_settings", {
        library_mode: next.library_mode, messages_mode: next.messages_mode,
        email_notify: next.email_notify === true, whatsapp: next.whatsapp || "",
        space_limit_mb: Math.round(Number(next.space_gb || 5) * 1024),
      });
      setS(next); setSaved("Zapisano.");
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Zmiana na „Włączone" wymaga potwierdzenia w oknie.
  const changeMode = (key, val) => {
    if (val === "on") { setConfirm({ key, val }); return; }
    save({ ...s, [key]: val });
  };

  const gb = Math.round((Number(s.space_limit_mb || 5120) / 1024) * 10) / 10;

  return (
    <section className="border hairline p-6 space-y-6">
      <div>
        <p className="technical text-[10px] gold-text mb-2">BIBLIOTEKA I WIADOMOŚCI</p>
        <p className="text-sm text-foreground/50">Dwa niezależne moduły. Wyłączone = nikt nie ma do nich dostępu.</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm">Moja biblioteka</p>
            <p className="text-xs text-foreground/45">Materiały i kolekcje dla klientów. „Tylko admin" = widzisz je wyłącznie Ty.</p>
          </div>
          <TriSwitch value={s.library_mode} onChange={(v) => changeMode("library_mode", v)} disabled={busy} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm">Wiadomości</p>
            <p className="text-xs text-foreground/45">Jednostronne wiadomości do klientów. „Tylko admin" = widzisz je wyłącznie Ty.</p>
          </div>
          <TriSwitch value={s.messages_mode} onChange={(v) => changeMode("messages_mode", v)} disabled={busy} />
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={s.email_notify === true} onChange={(e) => set("email_notify", e.target.checked)} className="mt-1 accent-[#C9A24A]" />
        <span>
          <span className="text-sm block">E-mail o nowych materiałach</span>
          <span className="text-xs text-foreground/45">Jeden zbiorczy e-mail, gdy przydzielisz komuś materiały. Domyślnie wyłączony.</span>
        </span>
      </label>

      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">WHATSAPP</label>
        <input value={s.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="https://wa.me/48123456789" className={inputCls} />
        <p className="text-xs text-foreground/45 mt-2">Tylko format <span className="gold-text">https://wa.me/&lt;cyfry&gt;</span> — kierunkowy bez plusa. Puste = brak przycisku.</p>
      </div>

      <div>
        <label className="technical text-[10px] text-foreground/50 block mb-2">PRÓG PRZESTRZENI (GB)</label>
        <input type="number" min="0.1" step="0.1" value={gb} onChange={(e) => set("space_gb", e.target.value)} className={inputCls} />
        <p className="text-xs text-foreground/45 mt-2">Powyżej 80% panel pokazuje ostrzeżenie.</p>
      </div>

      {err && <p className="text-sm blood-text">{err}</p>}
      {saved && <p className="text-sm gold-text">{saved}</p>}

      <button onClick={() => save(s)} disabled={busy} className="btn-relic">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "ZAPISZ"}
      </button>

      <LibModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Włączyć moduł?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirm(null)}>ANULUJ</button>
            <button className="btn-relic" onClick={() => { const c = confirm; setConfirm(null); save({ ...s, [c.key]: c.val }); }}>WŁĄCZ</button>
          </>
        }
      >
        <p className="text-sm text-foreground/70">
          Po włączeniu moduł stanie się widoczny dla klientów zgodnie z ustawieniem. Możesz go w każdej chwili wyłączyć.
        </p>
      </LibModal>
    </section>
  );
}