import React, { useEffect, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

const inputCls = "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";

function cloneValue(v) {
  return Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v;
}

export default function BlockEditor({ block, value, modified, onSave, onReset }) {
  const [draft, setDraft] = useState(() => cloneValue(value === undefined ? block.default : value));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(cloneValue(value === undefined ? block.default : value));
  }, [value]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border hairline p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="technical text-[10px] text-foreground/60">{block.label.toUpperCase()}</p>
        {modified && (
          <span className="technical text-[9px] px-2 py-1 border border-[#C9A24A]/40 gold-text">
            ZMODYFIKOWANY
          </span>
        )}
      </div>

      {/* Tekst jednolinijkowy */}
      {block.type === "text" && (
        <input value={draft} onChange={(e) => setDraft(e.target.value)} className={inputCls} />
      )}

      {/* Rozbudowany edytor tekstu */}
      {block.type === "richtext" && <RichTextEditor value={draft} onChange={setDraft} />}

      {/* Lista linii */}
      {block.type === "list" && (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => setDraft(draft.map((x, xi) => (xi === i ? e.target.value : x)))}
                className={inputCls}
              />
              <button
                onClick={() => setDraft(draft.filter((_, xi) => xi !== i))}
                className="text-foreground/40 hover:blood-text transition-colors p-2"
                aria-label="Usuń linię"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setDraft([...draft, ""])}
            className="btn-ghost !px-4 !py-2 text-[10px]"
          >
            <Plus className="h-3.5 w-3.5" /> DODAJ LINIĘ
          </button>
        </div>
      )}

      {/* Karty (pola zdefiniowane w rejestrze) */}
      {block.type === "cards" && (
        <div className="space-y-4">
          {draft.map((card, i) => (
            <div key={i} className="border hairline p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="technical text-[9px] text-foreground/40">#{i + 1}</span>
                <button
                  onClick={() => setDraft(draft.filter((_, ci) => ci !== i))}
                  className="text-foreground/40 hover:blood-text transition-colors"
                  aria-label="Usuń kartę"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {(block.fields || ["title", "text"]).map((f) => (
                <input
                  key={f}
                  value={card[f] || ""}
                  placeholder={f}
                  onChange={(e) =>
                    setDraft(draft.map((c, ci) => (ci === i ? { ...c, [f]: e.target.value } : c)))
                  }
                  className={inputCls}
                />
              ))}
            </div>
          ))}
          <button
            onClick={() =>
              setDraft([
                ...draft,
                Object.fromEntries((block.fields || ["title", "text"]).map((f) => [f, ""])),
              ])
            }
            className="btn-ghost !px-4 !py-2 text-[10px]"
          >
            <Plus className="h-3.5 w-3.5" /> DODAJ KARTĘ
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={saving} className="btn-relic !px-5 !py-2.5 text-[10px] disabled:opacity-60">
          <Save className="h-3.5 w-3.5" /> {saving ? "ZAPISUJĘ..." : "ZAPISZ"}
        </button>
        {modified && (
          <button onClick={onReset} className="btn-ghost !px-4 !py-2.5 text-[10px]">
            <RotateCcw className="h-3.5 w-3.5" /> PRZYWRÓĆ DOMYŚLNY
          </button>
        )}
      </div>
    </div>
  );
}