import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, X, Check, Pencil } from "lucide-react";

const inputCls =
  "w-full bg-transparent border hairline px-4 py-2.5 focus:border-[#C9A24A] focus:outline-none transition-colors text-sm";

export default function SubscribersPanel() {
  const [subs, setSubs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ email: "", name: "", status: "active", groups: [] });
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.functions.invoke("adminSubscribers", { action: "list" }).then((r) => r.data.subscribers).catch(() => []),
      base44.functions.invoke("adminNewsletter", { action: "groups.list" }).then((r) => r.data.groups).catch(() => []),
    ])
      .then(([s, g]) => {
        setSubs(s);
        setGroups(g);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const groupName = (id) => {
    const g = groups.find((x) => x.id === id);
    return g ? g.name : id;
  };

  const filtered = subs.filter((s) => s.email.toLowerCase().includes(search.toLowerCase()));

  const startEdit = (s) => {
    setEditId(s.id);
    setEditForm({ email: s.email, name: s.name || "", status: s.status, groups: s.groups || [] });
    setError("");
  };

  const saveEdit = async () => {
    setError("");
    setBusy(true);
    try {
      await base44.functions.invoke("adminSubscribers", {
        action: "save",
        id: editId,
        email: editForm.email,
        name: editForm.name,
        status: editForm.status,
        groups: editForm.groups,
      });
      setEditId(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!newEmail.trim()) return;
    setError("");
    setBusy(true);
    try {
      await base44.functions.invoke("adminSubscribers", {
        action: "save",
        email: newEmail.trim(),
        name: newName.trim(),
        status: "active",
        groups: [],
      });
      setNewEmail("");
      setNewName("");
      load();
    } catch (err) {
      setError(err?.response?.data?.error || "Nie udało się dodać.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Usunąć subskrybenta ${s.email}?`)) return;
    setBusy(true);
    try {
      await base44.functions.invoke("adminSubscribers", { action: "delete", id: s.id });
      load();
    } finally {
      setBusy(false);
    }
  };

  const activeCount = subs.filter((s) => s.status === "active").length;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="border hairline p-5">
          <p className="technical text-[9px] text-foreground/40 mb-2">WSZYSCY</p>
          <p className="font-mono text-3xl gold-text">{subs.length}</p>
        </div>
        <div className="border hairline p-5">
          <p className="technical text-[9px] text-foreground/40 mb-2">AKTYWNI</p>
          <p className="font-mono text-3xl gold-text">{activeCount}</p>
        </div>
        <div className="border hairline p-5">
          <p className="technical text-[9px] text-foreground/40 mb-2">WYPISANI</p>
          <p className="font-mono text-3xl text-foreground/40">{subs.length - activeCount}</p>
        </div>
        <div className="border hairline p-5">
          <p className="technical text-[9px] text-foreground/40 mb-2">GRUPY</p>
          <p className="font-mono text-3xl gold-text">{groups.length}</p>
        </div>
      </div>

      {/* Dodaj ręcznie */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          type="email"
          className={inputCls}
          placeholder="email nowego subskrybenta"
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={inputCls}
          placeholder="imię (opcjonalnie)"
        />
        <button
          onClick={add}
          disabled={busy}
          className="btn-relic !px-5 !py-2.5 whitespace-nowrap disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> DODAJ
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${inputCls} mb-4 max-w-sm`}
        placeholder="Szukaj po e-mailu..."
      />

      {error && <p className="text-sm blood-text mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 border hairline animate-pulse bg-[#0F0F10]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-foreground/50 border hairline p-10 text-center">
          {subs.length === 0
            ? "Brak subskrybentów — zapisy z footeru pojawią się tutaj."
            : "Brak wyników."}
        </p>
      ) : (
        <div className="border hairline divide-y divide-[#3D3D3F]/40">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 hover:bg-[#0F0F10] transition-colors">
              {editId === s.id ? (
                <>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputCls}
                    placeholder="email"
                  />
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className={`${inputCls} hidden sm:block`}
                    placeholder="imię"
                  />
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className={`${inputCls} bg-[#0A0A0B] w-auto`}
                  >
                    <option value="active">active</option>
                    <option value="unsubscribed">unsubscribed</option>
                  </select>
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
                    <p className="text-sm truncate font-mono">{s.email}</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {s.name && <p className="text-xs text-foreground/40 truncate">{s.name}</p>}
                      {(s.groups || []).map((gid) => (
                        <span key={gid} className="technical text-[8px] px-1.5 py-0.5 border border-[#C9A24A]/30 gold-text">
                          {groupName(gid)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => startEdit(s)} className="text-foreground/50 hover:gold-text transition-colors p-2" aria-label="Edytuj">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(s)} disabled={busy} className="text-foreground/40 hover:blood-text transition-colors p-2" aria-label="Usuń">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {editId && (
        <div className="mt-4 border hairline p-4">
          <p className="technical text-[10px] text-foreground/50 mb-3">GRUPY SUBSKRYBENTA</p>
          <div className="flex flex-wrap gap-4">
            {groups.length === 0 && (
              <p className="text-xs text-foreground/40">Brak grup — utwórz je w podzakładce Grupy.</p>
            )}
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-xs text-foreground/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.groups.includes(g.id)}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      groups: e.target.checked ? [...f.groups, g.id] : f.groups.filter((x) => x !== g.id),
                    }))
                  }
                />
                {g.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}