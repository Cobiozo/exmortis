import React, { useEffect, useState } from "react";
import { Loader2, Users, UsersRound, UserCheck, ShoppingBag, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { lib, inputCls } from "./libApi";
import ClientPicker from "./ClientPicker";

// Krok 1 wiadomości: do kogo. Cztery proste wybory zamiast „Osoby / Grupy” + dwóch list wyjątków.
export const MODES = [
  ["wszyscy", "Wszyscy z kontem", "Każde konto na stronie", Users],
  ["grupa", "Grupa", "Np. Kohorta 1, Alumni", UsersRound],
  ["osoby", "Wybrane osoby", "Zaznaczasz z listy", UserCheck],
  ["produkt", "Mają produkt", "Osoby z dostępem do produktu", ShoppingBag],
];

export const EMPTY_R = { mode: "wszyscy", group_id: "", emails: [], product_id: "", bez_testowych: true, exceptions_add: [], exceptions_drop: [] };

// Zapisany cel wiadomości (z serwera) → stan kroku 1.
export function fromTarget(t, allGroupId) {
  if (!t || !t.kind) return { ...EMPTY_R };
  if (t.kind === "grupa") {
    const all = allGroupId && t.group_id === allGroupId;
    return { ...EMPTY_R, mode: all ? "wszyscy" : "grupa", group_id: all ? "" : t.group_id || "", bez_testowych: false,
      exceptions_add: t.exceptions_add || [], exceptions_drop: t.exceptions_drop || [] };
  }
  return { ...EMPTY_R, mode: "osoby", emails: t.emails || [], bez_testowych: false };
}

// Stan kroku 1 → cel dla serwera (ten sam format co wcześniej: osoba / grupa z wyjątkami).
export function toTarget(r, clients, allGroupId) {
  const skip = new Set(r.bez_testowych ? (clients || []).filter((c) => c.test || c.zespol).map((c) => c.email) : []);
  const drop = [...new Set([...(r.exceptions_drop || []), ...skip])];
  if (r.mode === "wszyscy") {
    if (allGroupId) return { kind: "grupa", group_id: allGroupId, group_mode: "OBECNI_I_PRZYSZLI", exceptions_add: r.exceptions_add, exceptions_drop: drop };
    return { kind: "osoba", emails: (clients || []).map((c) => c.email).filter((e) => !skip.has(e)) };
  }
  if (r.mode === "grupa") {
    if (!r.group_id) return null;
    return { kind: "grupa", group_id: r.group_id, group_mode: "OBECNI_I_PRZYSZLI", exceptions_add: r.exceptions_add, exceptions_drop: drop };
  }
  const emails = (r.emails || []).filter((e) => !skip.has(e));
  return emails.length ? { kind: "osoba", emails } : null;
}

// Zapis zaznaczonych osób jako nowej grupy ręcznej (żeby następnym razem wybrać ją jednym kliknięciem).
function SaveAsGroup({ emails, onCreated }) {
  const [name, setName] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  if (!emails.length) return null;
  const go = async () => {
    if (!name.trim()) { setErr("Wpisz nazwę grupy."); return; }
    setBusy(true); setErr("");
    try {
      const g = await lib("group_save", { name: name.trim(), kind: "RECZNA" });
      await lib("group_members_add", { group_id: g.id, emails });
      setMsg(`Utworzono grupę „${name.trim()}” (${emails.length} ${emails.length === 1 ? "osoba" : "osób"}).`);
      setName(null); onCreated?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      {name === null ? (
        <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => { setName(""); setMsg(""); }}>Zapisz zaznaczone ({emails.length}) jako nową grupę</button>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa grupy, np. Kohorta 2" aria-label="Nazwa nowej grupy" className={`${inputCls} max-w-[260px]`} />
          <button type="button" className="btn-relic !px-3 !py-2" disabled={busy} onClick={go}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Utwórz grupę"}</button>
          <button type="button" className="btn-ghost !px-3 !py-2" onClick={() => setName(null)}>Anuluj</button>
        </div>
      )}
      {msg && <p className="text-xs gold-text" role="status">{msg}</p>}
      {err && <p className="text-xs blood-text" role="alert">{err}</p>}
    </div>
  );
}

export default function RecipientStep({ r, setR, clients, groups, onReloadGroups }) {
  const [holders, setHolders] = useState(null);
  const [products, setProducts] = useState(null);
  const [showEx, setShowEx] = useState((r.exceptions_add?.length || 0) + (r.exceptions_drop?.length || 0) > 0);
  const set = (k, v) => setR((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (r.mode === "produkt" && !products) lib("products_for_message").then((d) => setProducts(d.items || [])).catch(() => setProducts([]));
  }, [r.mode, products]);
  useEffect(() => {
    if (r.mode !== "produkt" || !r.product_id) { setHolders(null); return; }
    setHolders(undefined);
    lib("product_holders", { product_id: r.product_id }).then((d) => {
      const list = d.emails || [];
      const known = new Map((clients || []).map((c) => [c.email, c]));
      setHolders(list.map((e) => known.get(e) || { email: e, name: "", bez_konta: true }));
      setR((x) => ({ ...x, emails: list }));
    }).catch(() => setHolders([]));
  }, [r.mode, r.product_id]);  

  const chip = (on) => `text-left rounded-none border p-3 min-h-[64px] ${on ? "border-[#C9A24A] bg-[#C9A24A]/10" : "hairline hover:border-[#C9A24A]/50"}`;
  const others = (groups || []).filter((g) => !(g.kind === "AUTOMATYCZNA" && g.rule?.typ === "wszystkie_konta"));
  const nTest = (clients || []).filter((c) => c.test || c.zespol).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="radiogroup" aria-label="Do kogo">
        {MODES.map(([k, l, d, Icon]) => (
          <button key={k} type="button" role="radio" aria-checked={r.mode === k} className={chip(r.mode === k)}
            onClick={() => setR((x) => ({ ...x, mode: k }))}>
            <span className="flex items-center gap-2 text-sm font-semibold text-[#F1EDE3]"><Icon className="h-4 w-4 gold-text" aria-hidden="true" /> {l}</span>
            <span className="block text-[11px] text-foreground/50 mt-1">{d}</span>
          </button>
        ))}
      </div>

      {r.mode === "grupa" && (
        <label className="block"><span className="technical text-[10px] text-foreground/50 block mb-2">GRUPA</span>
          <select value={r.group_id} onChange={(e) => set("group_id", e.target.value)} className={inputCls}>
            <option value="">— wybierz grupę —</option>
            {others.map((g) => <option key={g.id} value={g.id}>{g.name}{g.kind === "AUTOMATYCZNA" ? " (automatyczna)" : ""}</option>)}
          </select>
          {!others.length && <span className="block text-xs text-foreground/50 mt-1">Nie ma jeszcze grup — utwórz ją niżej albo z „Wybranych osób”.</span>}
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a href="/admin/grupy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 gold-text min-h-[32px]"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Dodaj, edytuj lub usuń grupy (nowa karta)</a>
            {onReloadGroups && <button type="button" onClick={onReloadGroups} className="inline-flex items-center gap-1 text-foreground/70 hover:gold-text min-h-[32px]"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Odśwież listę grup</button>}
          </span>
        </label>
      )}

      {r.mode === "osoby" && (
        <>
          <p className="text-xs text-foreground/55">Zaznacz jedną osobę albo kilka. Często piszesz do tych samych osób? Zapisz je jako grupę.</p>
          <ClientPicker items={clients} value={r.emails} onChange={(v) => set("emails", v)} />
          <SaveAsGroup emails={r.emails} onCreated={onReloadGroups} />
        </>
      )}

      {r.mode === "produkt" && (
        <div className="space-y-3">
          <label className="block"><span className="technical text-[10px] text-foreground/50 block mb-2">PRODUKT</span>
            <select value={r.product_id} onChange={(e) => set("product_id", e.target.value)} className={inputCls}>
              <option value="">— wybierz produkt —</option>
              {(products || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></label>
          {holders === undefined && <Loader2 className="h-4 w-4 animate-spin gold-text" aria-label="Wczytuję" />}
          {holders && !holders.length && <p className="text-xs text-foreground/55">Nikt nie ma teraz dostępu do tego produktu.</p>}
          {holders && holders.length > 0 && (
            <>
              <p className="text-xs text-foreground/55">Osoby z aktywnym dostępem — wszystkie zaznaczone, możesz kogoś odznaczyć.
                {holders.some((h) => h.bez_konta) ? " Osoby bez konta dostaną tylko e-mail (jeśli go włączysz w kroku 3)." : ""}</p>
              <ClientPicker items={holders} value={r.emails} onChange={(v) => set("emails", v)} />
            </>
          )}
        </div>
      )}

      {nTest > 0 && (
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="accent-[#C9A24A] h-4 w-4 mt-0.5" checked={r.bez_testowych} onChange={(e) => set("bez_testowych", e.target.checked)} />
          <span>Pomiń konta testowe i zespół <span className="text-foreground/50">({nTest}: {(clients || []).filter((c) => c.test || c.zespol).map((c) => c.name || c.email).join(", ")})</span></span>
        </label>
      )}

      {(r.mode === "wszyscy" || r.mode === "grupa") && (
        <div className="border hairline">
          <button type="button" onClick={() => setShowEx((v) => !v)} aria-expanded={showEx}
            className="w-full min-h-[44px] px-3 flex items-center justify-between text-sm text-foreground/75">
            <span>Wyjątki {(r.exceptions_add.length + r.exceptions_drop.length) ? `(dodane: ${r.exceptions_add.length}, wykluczone: ${r.exceptions_drop.length})` : "— dodaj kogoś spoza listy albo kogoś wyklucz"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showEx ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showEx && (
            <div className="border-t hairline p-3 grid lg:grid-cols-2 gap-4">
              {r.mode === "grupa" && (
                <div><p className="technical text-[10px] text-foreground/50 mb-2">DODAJ SPOZA GRUPY</p>
                  <ClientPicker items={clients} value={r.exceptions_add} onChange={(v) => set("exceptions_add", v)} /></div>
              )}
              <div><p className="technical text-[10px] text-foreground/50 mb-2">WYKLUCZ</p>
                <ClientPicker items={clients} value={r.exceptions_drop} onChange={(v) => set("exceptions_drop", v)} /></div>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-foreground/45">Lista odbiorców liczy się w chwili wysyłki — przy zaplanowanej wiadomości dojdą też konta założone do tego czasu.</p>
    </div>
  );
}
