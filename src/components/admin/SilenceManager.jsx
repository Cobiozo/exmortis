import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const SLOTS = [
  { key: "intro_uri", label: "INTRO — GŁOS NA POCZĄTEK" },
  { key: "outro_uri", label: "OUTRO — GŁOS NA KONIEC" },
  { key: "background_uri", label: "TŁO — CICHA MUZYKA" },
];

// Minutnik ciszy — wgranie plików audio. Bez pliku opcja nie pokazuje się na stronie.
export default function SilenceManager() {
  const [settings, setSettings] = useState(null);
  const [previews, setPreviews] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const res = await base44.functions.invoke("silenceAdmin", { action: "get" });
    const s = res.data.settings || {};
    setSettings(s);
    const next = {};
    await Promise.all(
      SLOTS.map(async (slot) => {
        if (!s[slot.key]) return;
        try {
          const r = await base44.integrations.Core.CreateFileSignedUrl({
            file_uri: s[slot.key],
            expires_in: 600,
          });
          next[slot.key] = r.signed_url;
        } catch {
          /* podgląd nie krytyczny */
        }
      })
    );
    setPreviews(next);
  };

  useEffect(() => {
    load().catch(() => setSettings({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (slotKey, uri) => {
    const payload = { action: "save" };
    SLOTS.forEach((s) => {
      payload[s.key] = s.key === slotKey ? uri : settings?.[s.key] || null;
    });
    await base44.functions.invoke("silenceAdmin", payload);
  };

  const upload = async (slotKey, file) => {
    if (!file) return;
    setBusy(slotKey);
    setError("");
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await save(slotKey, file_uri);
      await load();
    } catch (e) {
      setError("Nie udało się wgrać pliku. Spróbuj ponownie.");
    }
    setBusy("");
  };

  const remove = async (slotKey) => {
    setBusy(slotKey);
    setError("");
    try {
      await save(slotKey, null);
      await load();
    } catch {
      setError("Nie udało się usunąć pliku.");
    }
    setBusy("");
  };

  if (settings === null) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-8 h-8 border-4 border-[#3D3D3F] border-t-[#C9A24A] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <p className="technical text-[11px] gold-text mb-2">MINUTNIK CISZY · PLIKI AUDIO</p>
      <p className="text-sm text-foreground/50 mb-8 max-w-2xl leading-relaxed">
        Wgraj własne nagrania. Pusta pozycja oznacza, że opcja dźwięku nie wyświetla się na
        stronie. „Mój głos” wymaga zarówno intro, jak i outro.
      </p>
      {error && <p className="mb-6 text-sm blood-text">{error}</p>}

      <div className="grid md:grid-cols-3 gap-6">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="border hairline p-6 flex flex-col">
            <p className="technical text-[10px] text-foreground/60 mb-4">{slot.label}</p>
            {previews[slot.key] ? (
              <audio controls src={previews[slot.key]} className="w-full mb-4" />
            ) : (
              <p className="text-xs text-foreground/35 mb-4">
                Brak pliku — opcja nie jest widoczna na stronie.
              </p>
            )}
            <div className="mt-auto flex flex-wrap gap-3">
              <label
                className={`btn-ghost !px-4 !py-2 cursor-pointer ${busy === slot.key ? "opacity-50 pointer-events-none" : ""}`}
              >
                {busy === slot.key
                  ? "WGROWANIE…"
                  : settings[slot.key]
                  ? "ZAMIEŃ PLIK"
                  : "WGRAJ PLIK"}
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => upload(slot.key, e.target.files?.[0])}
                />
              </label>
              {settings[slot.key] && (
                <button
                  onClick={() => remove(slot.key)}
                  disabled={busy === slot.key}
                  className="btn-ghost !px-4 !py-2 disabled:opacity-50"
                >
                  USUŃ
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}