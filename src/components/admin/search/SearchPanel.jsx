import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Loader2, User, ShoppingBag, Package, CalendarDays, Mail } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Wyszukiwarka panelu (28.11.2026): jedno pole → osoby, zamówienia, produkty, spotkania, wiadomości.
const qs = () => { try { return new URLSearchParams(window.location.search).get("q") || ""; } catch { return ""; } };
const zl = (n) => `${Number(n || 0).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;
const day = (d) => (d ? new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) : "");
const enc = encodeURIComponent;

function Group({ icon: Icon, title, rows, render }) {
  if (!rows?.length) return null;
  return (
    <section className="border hairline">
      <p className="flex items-center gap-2 technical text-[10px] gold-text px-4 py-3 border-b hairline">
        <Icon className="h-3.5 w-3.5" /> {title} <span className="text-foreground/40">· {rows.length}</span>
      </p>
      <ul className="divide-y divide-[#3D3D3F]/40">{rows.map(render)}</ul>
    </section>
  );
}
const rowCls = "flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-white/[0.03] text-sm";

export default function SearchPanel() {
  const navigate = useNavigate();
  const [q, setQ] = useState(qs);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes(null); return undefined; }
    const id = setTimeout(async () => {
      setBusy(true); setErr("");
      try {
        const r = await base44.functions.invoke("adminClients", { action: "search", q: t });
        setRes(r.data);
        navigate(`/admin/szukaj?q=${enc(t)}`, { replace: true });
      } catch (e) { setErr(e?.message || "Nie udało się wyszukać."); }
      setBusy(false);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const empty = res && !["people", "orders", "products", "events", "messages"].some((k) => res[k]?.length);

  return (
    <div className="space-y-6 max-w-4xl">
      <label className="relative block">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="E-mail, imię, numer zamówienia, produkt, spotkanie…" aria-label="Szukaj w panelu"
          className="w-full bg-[#0F0F10] border hairline pl-9 pr-10 py-3 text-base focus:outline-none focus:border-[#C9A24A]/60" />
        {busy && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40" />}
      </label>
      {err && <p className="text-sm blood-text">{err}</p>}
      {q.trim().length < 2 && <p className="text-sm text-foreground/50">Wpisz co najmniej 2 znaki. Szukam w kontach, zamówieniach, newsletterze, zapisach na spotkania, zgłoszeniach POWRÓT, wiadomościach, produktach i spotkaniach.</p>}
      {empty && <p className="text-sm text-foreground/50">Nic nie znalazłem dla „{q.trim()}”.</p>}
      {res && (
        <div className="space-y-5">
          <Group icon={User} title="OSOBY" rows={res.people} render={(p) => (
            <li key={p.email}><Link to={`/admin/klienci?email=${enc(p.email)}`} className={rowCls}>
              <span>{p.name || "—"}</span><span className="font-mono text-foreground/60">{p.email}</span>
              <span className="text-xs text-foreground/40 basis-full sm:basis-auto sm:ml-auto">{p.sources}</span>
            </Link></li>
          )} />
          <Group icon={ShoppingBag} title="ZAMÓWIENIA" rows={res.orders} render={(o) => (
            <li key={o.id}><Link to={`/admin/zamowienia?q=${enc(o.buyer_email || o.id)}`} className={rowCls}>
              <span className="text-foreground/50">{day(o.created_date)}</span><span>{o.buyer_name || o.buyer_email}</span>
              <span className="font-mono">{zl(o.total)}</span><span className="text-xs text-foreground/50">{o.status}</span>
              {o.items && <span className="text-xs text-foreground/40 basis-full truncate">{o.items}</span>}
            </Link></li>
          )} />
          <Group icon={Package} title="PRODUKTY" rows={res.products} render={(p) => (
            <li key={p.id}><Link to="/admin/skarbiec" className={rowCls}>
              <span>{p.name}</span><span className="text-xs text-foreground/50">{p.product_type} · {p.status}</span>
            </Link></li>
          )} />
          <Group icon={CalendarDays} title="SPOTKANIA" rows={res.events} render={(e) => (
            <li key={e.id}><Link to="/admin/spotkania" className={rowCls}>
              <span>{e.title}</span><span className="text-foreground/50">{day(e.start_datetime)}</span><span className="text-xs text-foreground/50">{e.status}</span>
            </Link></li>
          )} />
          <Group icon={Mail} title="WIADOMOŚCI" rows={res.messages} render={(m) => (
            <li key={m.id}><Link to={`/admin/skrzynka?q=${enc(m.email || m.name || "")}`} className={rowCls}>
              <span className="text-foreground/50">{day(m.created_date)}</span><span>{m.name}</span><span className="font-mono text-foreground/60">{m.email}</span>
              <span className="text-xs text-foreground/40 basis-full truncate">{m.preview}</span>
            </Link></li>
          )} />
        </div>
      )}
    </div>
  );
}
