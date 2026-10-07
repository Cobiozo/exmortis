import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { VIEWS } from "@/components/exmortis/cisza/views";

// Muzyka w Ciszy (globalnie, domyślnie wyłączona) + widok domyślny.
export default function SilenceModeSettings({ settings, onSaved }) {
  const [busy, setBusy] = useState(false);
  const save = async (patch) => {
    setBusy(true);
    const E = base44.entities.SilenceSettings;
    const rec = settings.id ? await E.update(settings.id, patch) : await E.create({ ...patch });
    onSaved({ ...patch, id: rec.id });
    setBusy(false);
  };
  return (
    <section className="border hairline p-6 bg-[#0F0F10] space-y-6">
      <h2 className="relic-heading text-2xl">Tryb ciszy</h2>
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span>
          <span className="block text-[#F5EFE1]">Muzyka w Ciszy: {settings.muzyka_wlaczona ? "włączona" : "wyłączona"}</span>
          <span className="block text-xs text-foreground/45 mt-1">Wyłączona — strona gra tylko sygnały wstępu i zakończenia. Utwory i pliki zostają w bazie.</span>
        </span>
        <Switch checked={!!settings.muzyka_wlaczona} disabled={busy} onCheckedChange={(v) => save({ muzyka_wlaczona: v })} />
      </label>
      <div>
        <p className="text-sm text-[#F5EFE1] mb-2">Widok domyślny</p>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" disabled={busy} onClick={() => save({ widok_domyslny: v.id })}
              className={`px-4 min-h-[44px] border text-sm ${(settings.widok_domyslny || "cyfry_pasek") === v.id ? "border-[#C9A24A] gold-text" : "hairline text-foreground/60"}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}