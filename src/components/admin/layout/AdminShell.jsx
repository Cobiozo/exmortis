import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Menu, X, Eye, ExternalLink, UserRound, LogOut, ShoppingBag, CalendarDays, Contact, PenLine, Settings } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/exmortis/Logo";
import { useAdminMode } from "@/components/admin/AdminModeContext";
import { siteFor } from "@/components/admin/adminLinks";
import { navFor } from "./adminNav";

// Układ panelu: menu z boku (komputer) albo górny pasek + szuflada + dolny pasek (telefon).
// Same linki i wyjścia co dotąd — zmienia się tylko wygląd i miejsce.
const itemCls = (on) =>
  `group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
    on ? "bg-[#C9A24A]/12 text-[#F1EDE3]" : "text-foreground/65 hover:text-foreground hover:bg-white/[0.04]"
  }`;

function Badge({ n }) {
  if (!n) return null;
  return (
    <span className="ml-auto min-w-[20px] px-1.5 text-center rounded-full bg-[#C9A24A]/20 text-[#E2C27A] text-[11px] font-semibold leading-5">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function NavContent({ me, groups, active, badges, onPreload, onNavigate }) {
  const { setMode } = useAdminMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const exit = "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-foreground/65 hover:text-foreground hover:bg-white/[0.04] w-full text-left";
  return (
    <div className="flex flex-col h-full">
      <Link to="/admin" onClick={onNavigate} className="flex items-center gap-3 px-3 pb-6">
        <Logo className="h-10 w-10" glow={false} />
        <span>
          <span className="block relic-heading text-lg leading-none">exmortis</span>
          <span className="technical text-[10px] text-foreground/45">ZAPLECZE</span>
        </span>
      </Link>

      <nav aria-label="Moduły panelu" className="flex-1 space-y-5">
        <Link to="/admin" onClick={onNavigate} aria-current={!active ? "page" : undefined} className={itemCls(!active)}>
          <Home className={`h-4 w-4 ${!active ? "text-[#C9A24A]" : "text-foreground/40 group-hover:text-foreground/70"}`} /> Pulpit
        </Link>
        {groups.map(([name, items]) => (
          <div key={name}>
            <p className="px-3 pb-1.5 technical text-[10px] text-foreground/40">{name.toUpperCase()}</p>
            <div className="space-y-0.5">
              {items.map(({ key, label, icon: Icon, preview }) => {
                const on = active === key;
                const ic = <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[#C9A24A]" : "text-foreground/40 group-hover:text-foreground/70"}`} />;
                return preview ? (
                  <Link key={key} to="/" onClick={() => { setMode("admin"); onNavigate?.(); }} className={itemCls(false)}>{ic}{label}</Link>
                ) : (
                  <Link key={key} to={`/admin/${key}`} onClick={onNavigate} onMouseEnter={() => onPreload?.(key)} onFocus={() => onPreload?.(key)}
                    aria-current={on ? "page" : undefined} className={itemCls(on)}>
                    {ic}<span className="truncate">{label}</span><Badge n={badges?.[key]} />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 pt-4 border-t hairline space-y-0.5">
        <Link to="/" onClick={() => setMode("admin")} className={exit}><Eye className="h-4 w-4 text-foreground/40" /> Zobacz stronę</Link>
        <a href="/" target="_blank" rel="noopener" className={exit}><ExternalLink className="h-4 w-4 text-foreground/40" /> Strona w nowej karcie</a>
        <button type="button" onClick={() => { setMode("guest"); navigate(siteFor(pathname)); }} className={exit}><Eye className="h-4 w-4 text-foreground/40" /> Widok gościa</button>
        <Link to="/konto" onClick={() => setMode("admin")} className={exit}><UserRound className="h-4 w-4 text-foreground/40" /> Moje konto</Link>
        <button type="button" onClick={() => base44.auth.logout("/")} className={exit}><LogOut className="h-4 w-4 text-foreground/40" /> Wyloguj</button>
        <p className="px-3 pt-2 text-[11px] text-foreground/35 truncate" title={me?.email}>{me?.email}</p>
      </div>
    </div>
  );
}

export default function AdminShell({ me, tech, techKeys, libOn, badges, active, title, actions, onPreload, children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const groups = navFor({ tech, techKeys, libOn });
  const nav = { me, groups, active, badges, onPreload };
  const tabs = tech
    ? [["", "Pulpit", Home], ["tresci", "Treści", PenLine], ["ustawienia", "Ustawienia", Settings]]
    : [["", "Pulpit", Home], ["zamowienia", "Zamówienia", ShoppingBag], ["spotkania", "Spotkania", CalendarDays], ["kontakty", "Kontakty", Contact]];

  return (
    <div className="min-h-screen bg-[#0A0A0B] lg:flex">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen overflow-y-auto border-r hairline bg-[#0D0D0E] px-3 py-6">
        <NavContent {...nav} />
      </aside>

      {/* Telefon: górny pasek */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 h-16 border-b hairline bg-[#0A0A0B]/95 backdrop-blur">
        <button type="button" onClick={() => setOpen(true)} aria-label="Otwórz menu panelu" className="h-11 w-11 inline-flex items-center justify-center rounded-md border hairline">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/admin" className="flex items-center gap-2"><Logo className="h-8 w-8" glow={false} /><span className="technical text-[10px] text-foreground/55">ZAPLECZE</span></Link>
        <span className="w-11" />
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu panelu">
          <button type="button" aria-label="Zamknij menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-[#0D0D0E] border-r hairline overflow-y-auto px-3 py-5">
            <button type="button" onClick={() => setOpen(false)} aria-label="Zamknij menu" className="absolute right-3 top-4 h-11 w-11 inline-flex items-center justify-center rounded-md text-foreground/60">
              <X className="h-5 w-5" />
            </button>
            <NavContent {...nav} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 pb-24 lg:pb-12">
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 md:px-8 lg:px-10 pt-6 lg:pt-8 pb-5 border-b hairline">
          <h1 className="relic-heading text-3xl md:text-4xl">{title}</h1>
          {actions}
        </header>
        <main className="px-5 md:px-8 lg:px-10 pt-6 lg:pt-8 max-w-[1400px]">{children}</main>
      </div>

      {/* Telefon: dolny pasek z najczęstszymi miejscami */}
      <nav aria-label="Szybka nawigacja" className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t hairline bg-[#0D0D0E]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map(([k, label, Icon]) => {
            const on = (active || "") === k;
            return (
              <Link key={k || "pulpit"} to={k ? `/admin/${k}` : "/admin"} aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[56px] text-[11px] ${on ? "text-[#C9A24A]" : "text-foreground/55"}`}>
                <Icon className="h-5 w-5" />{label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center justify-center gap-1 min-h-[56px] text-[11px] text-foreground/55">
            <Menu className="h-5 w-5" />Menu
          </button>
        </div>
      </nav>
    </div>
  );
}
