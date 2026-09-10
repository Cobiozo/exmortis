import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, X, Check, Pencil } from "lucide-react";

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";

export default function GroupsPanel() {
  const [groups, setGroups] = useState(null);
  const [totalActive, setTotalActive] = useState(0);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    base44.functions
      .invoke("adminNewsletter", { action: "groups.list" })
      .then((r) => {
        setGroups(r.data.groups);
        setTotalActive(r.data.totalActive);
      })
      .catch(() => setGroups([]));
  };
  useEffect(load, []);

  const add = async () => {
    if (!newName.trim()) return;
    setError("");
    setBusy(true);
    try {
      await base44.functions.invoke("adminNewsletter", { action: "groups.save", name: newName.trim() });
      setNewName("");
      load();
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się dodać grupy.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      await base44.functions.invoke("adminNewsletter", {
        action: "groups.save",
        id: editId,
        name: editName.trim(),
      });
      setEditId(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g) => {
    if (!window.confirm(`Usunąć grupę „${g.name}"? Subskrybenci pozostaną na liście.`)) return;
    setBusy(true);
    try {
      await base44.functions.invoke("adminNewsletter", { action: "groups.delete", id: g.id });
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-4 mb-8 max-w-lg">
        <div className="border hairline p-5">
          <p className="technical text-[9px] text-foreground/40 mb-2">WSZYSCY AKTYWNI</p>
          <p className="font-mono text-3xl gold-text">{totalActive}</p>
        </div>
        <div className="border hairline p-5">
          <p className="technical text-[9px] text-foreground/40 mb-2">GRUPY</p>
          <p className="font-mono text-3xl gold-text">{groups ? groups.length : "…"}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8 max-w-xl">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={inputCls}
          placeholder="nazwa nowej grupy (np. List powrotu)"
        />
        <button
          onClick={add}
          disabled={busy}
          className="btn-relic !px-5 !py-2.5 whitespace-nowrap disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> UTWÓRZ GRUPĘ
        </button>
      </div>

      {error && <p className="text-sm blood-text mb-4">{error}</p>}

      {groups === null ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 border hairline animate-pulse bg-[#0F0F10]" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-foreground/50 border hairline p-10 text-center">
          Brak grup — utwórz pierwszą, by grupować odbiorców kampanii.
        </p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/40">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-3 p-3 hover:bg-[#0F0F10] transition-colors">
              {editId === g.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputCls}
                  />
                  <button onClick={saveEdit} disabled={busy} className="text-[#C9A24A] p-2" aria-label="Zapisz">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditId(null)} className="text-foreground/40 p-2" aria-label="Anuluj">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{g.name}</p>
                  </div>
                  <span className="technical text-[9px] px-2 py-1 border border-[#C9A24A]/40 gold-text">
                    {Number(g.members)} OS.
                  </span>
                  <button
                    onClick={() => {
                      setEditId(g.id);
                      setEditName(g.name);
                    }}
                    className="text-foreground/50 hover:gold-text transition-colors p-2"
                    aria-label="Edytuj"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(g)}
                    disabled={busy}
                    className="text-foreground/40 hover:blood-text transition-colors p-2"
                    aria-label="Usuń"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}