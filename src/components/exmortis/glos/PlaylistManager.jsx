import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { extractVideoId } from "./youtube";

// Panel „Zarządzaj playlistą" — widoczny tylko dla administratora.
export default function PlaylistManager({ onMutate }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  const [rows, setRows] = useState([]);
  const [url, setUrl] = useState("");
  const [tytul, setTytul] = useState("");
  const [opis, setOpis] = useState("");
  const [urlError, setUrlError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const load = () =>
    base44.entities.Utwor
      .filter({}, { sort: "kolejnosc", limit: 200 })
      .then((r) => setRows(r.items || []))
      .catch(() => setRows([]));

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const changed = (fn) => {
    load();
    onMutate?.();
    return fn;
  };

  // Tytuł z oEmbed (https://www.youtube.com/oembed?url=LINK&format=json).
  const fetchTitle = async (raw) => {
    const id = extractVideoId(raw);
    if (!id) {
      setUrlError("Nieprawidłowy link YouTube.");
      return;
    }
    setUrlError("");
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${id}`
        )}`
      );
      if (res.ok) {
        const d = await res.json();
        if (d.title) setTytul(d.title);
      }
    } catch {
      // Brak tytułu — administrator może wpisać ręcznie.
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const id = extractVideoId(url);
    if (!id) {
      setUrlError("Nieprawidłowy link YouTube.");
      return;
    }
    setBusy(true);
    try {
      let title = tytul.trim();
      if (!title) {
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${id}`
            )}`
          );
          if (res.ok) title = (await res.json()).title || "";
        } catch {}
      }
      const maxK = rows.reduce((m, r) => Math.max(m, r.kolejnosc || 0), 0);
      await base44.entities.Utwor.create({
        tytul: title || "Bez tytułu",
        youtube_url: url.trim(),
        opis: opis.trim(),
        kolejnosc: maxK + 1,
        widoczny: true,
        data_dodania: new Date().toISOString(),
      });
      setUrl("");
      setTytul("");
      setOpis("");
      setUrlError("");
      changed(() => {});
    } finally {
      setBusy(false);
    }
  };

  const saveRow = async (r, patch) => {
    await base44.entities.Utwor.update(r.id, patch);
    changed(() => {});
  };

  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i];
    const b = rows[j];
    await base44.entities.Utwor.bulkUpdate([
      { id: a.id, kolejnosc: b.kolejnosc ?? j + 1 },
      { id: b.id, kolejnosc: a.kolejnosc ?? i + 1 },
    ]);
    changed(() => {});
  };

  const remove = async (r) => {
    await base44.entities.Utwor.delete(r.id);
    setConfirmId(null);
    changed(() => {});
  };

  return (
    <div className="mt-16 border hairline p-6 md:p-10 bg-[#0A0A0B]">
      <p className="technical text-[11px] gold-text mb-2">ADMIN</p>
      <h3 className="relic-heading text-2xl md:text-3xl mb-8">Zarządzaj playlistą</h3>

      {/* Dodawanie */}
      <form onSubmit={add} className="grid md:grid-cols-2 gap-4 mb-10">
        <div className="md:col-span-2">
          <label className="technical text-[10px] text-foreground/50 block mb-2">
            LINK YOUTUBE
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => url.trim() && fetchTitle(url)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full bg-[#070708] border hairline px-4 py-3 text-foreground focus:border-[#C9A24A] outline-none"
          />
          {urlError && <p className="text-[#BC1E22] text-xs mt-1">{urlError}</p>}
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">
            TYTUŁ (UZUPEŁNIA SIĘ AUTOMATYCZNIE)
          </label>
          <input
            value={tytul}
            onChange={(e) => setTytul(e.target.value)}
            placeholder="Tytuł utworu"
            className="w-full bg-[#070708] border hairline px-4 py-3 text-foreground focus:border-[#C9A24A] outline-none"
          />
        </div>
        <div>
          <label className="technical text-[10px] text-foreground/50 block mb-2">
            OPIS (OPCJONALNIE)
          </label>
          <input
            value={opis}
            onChange={(e) => setOpis(e.target.value)}
            placeholder="Jedno zdanie o utworze"
            className="w-full bg-[#070708] border hairline px-4 py-3 text-foreground focus:border-[#C9A24A] outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <button type="submit" disabled={busy} className="btn-relic disabled:opacity-50">
            <Plus className="h-4 w-4" /> {busy ? "DODAJĘ..." : "DODAJ UTWÓR"}
          </button>
          <p className="technical text-[9px] text-foreground/55 mt-3">
            NOWY UTWÓR TRAFIA NA KONIEC LISTY.
          </p>
        </div>
      </form>

      {/* Lista — edycja, kolejność, widoczność, usuwanie */}
      {rows.length === 0 ? (
        <p className="text-foreground/50 text-sm">Playlista jest pusta.</p>
      ) : (
        <div className="divide-y divide-[#3D3D3F]/40 border-y hairline">
          {rows.map((r, i) => (
            <div
              key={`${r.id}-${r.updated_date || ""}`}
              className="py-5 flex flex-col lg:flex-row lg:items-center gap-4"
            >
              <span className="technical text-[10px] text-foreground/55 w-8 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0 grid md:grid-cols-2 gap-3">
                <input
                  defaultValue={r.tytul}
                  onBlur={(e) =>
                    e.target.value.trim() && e.target.value.trim() !== r.tytul
                      ? saveRow(r, { tytul: e.target.value.trim() })
                      : undefined
                  }
                  className="w-full bg-[#070708] border hairline px-3 py-2 text-sm text-foreground focus:border-[#C9A24A] outline-none"
                />
                <input
                  defaultValue={r.opis || ""}
                  onBlur={(e) =>
                    (e.target.value || "") !== (r.opis || "")
                      ? saveRow(r, { opis: e.target.value.trim() })
                      : undefined
                  }
                  placeholder="Opis (opcjonalnie)"
                  className="w-full bg-[#070708] border hairline px-3 py-2 text-sm text-foreground/70 focus:border-[#C9A24A] outline-none"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-2 border hairline text-foreground/60 hover:gold-text hover:border-[#C9A24A]/60 disabled:opacity-25 disabled:hover:text-foreground/60 transition-colors"
                  aria-label="W górę"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  className="p-2 border hairline text-foreground/60 hover:gold-text hover:border-[#C9A24A]/60 disabled:opacity-25 disabled:hover:text-foreground/60 transition-colors"
                  aria-label="W dół"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => saveRow(r, { widoczny: !r.widoczny })}
                  className={`p-2 border hairline transition-colors ${
                    r.widoczny
                      ? "gold-text border-[#C9A24A]/40"
                      : "text-foreground/55 hover:text-foreground/70"
                  }`}
                  aria-label={r.widoczny ? "Ukryj" : "Pokaż"}
                >
                  {r.widoczny ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                {confirmId === r.id ? (
                  <>
                    <button
                      onClick={() => remove(r)}
                      className="p-2 border border-[#BC1E22]/60 text-[#BC1E22] hover:bg-[#BC1E22]/10 transition-colors"
                      aria-label="Potwierdź usunięcie"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="p-2 border hairline text-foreground/50 hover:text-foreground transition-colors"
                      aria-label="Anuluj"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmId(r.id)}
                    className="p-2 border hairline text-foreground/55 hover:text-[#BC1E22] hover:border-[#BC1E22]/50 transition-colors"
                    aria-label="Usuń"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="technical text-[9px] text-foreground/55 lg:w-24 shrink-0">
                {r.widoczny ? "WIDOCZNY" : "UKRYTY"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}