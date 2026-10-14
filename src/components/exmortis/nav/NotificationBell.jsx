import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, X, Megaphone, Sparkles, Hourglass, Tag, Ticket, CalendarDays, CalendarClock, PlayCircle, Clock, Mail, Compass, Headphones, Copy, Check, Settings, BellRing, Receipt, CreditCard, GraduationCap } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useViewer } from "@/lib/useViewer";
import { ANN_SEEN } from "@/components/account/announce/annApi";
import { notif, ago, NOTIF_REFRESH } from "./notifApi";

const ICON = { ogloszenie: Megaphone, produkt: Sparkles, wkrotce: Hourglass, promocja: Tag, kod: Ticket, spotkanie: CalendarDays,
  moje_spotkanie: CalendarClock, nagranie: PlayCircle, dostep: Clock, wiadomosc: Mail, historia: Compass, obok: Headphones,
  lista: BellRing, zamowienie: Receipt, platnosc: CreditCard, lekcja: GraduationCap };
const LABEL = { ogloszenie: "Ogłoszenie", produkt: "Nowość", wkrotce: "Zapowiedź", promocja: "Promocja", kod: "Kod rabatowy", spotkanie: "Spotkanie",
  moje_spotkanie: "Twoje spotkanie", nagranie: "Nagranie", dostep: "Dostęp", wiadomosc: "Wiadomość", historia: "ROZDROŻA", obok: "Obok",
  lista: "Lista oczekujących", zamowienie: "Zamówienie", platnosc: "Płatność", lekcja: "Kurs" };
const POLL = 5 * 60 * 1000;

function CodeCopy({ code }) {
  const [ok, setOk] = useState(false);
  const copy = (e) => {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard?.writeText(code).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {});
  };
  return (
    <button type="button" onClick={copy} className="mt-2 inline-flex items-center gap-1.5 border border-[#C9A24A]/50 px-2 py-1 font-mono text-xs gold-text hover:bg-[#C9A24A]/10">
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {ok ? "Skopiowano" : code}
    </button>
  );
}

// Dzwoneczek w nagłówku: nowości, promocje, spotkania, sprawy konta i ogłoszenia — tylko dla zalogowanych.
export default function NotificationBell() {
  const { user } = useViewer();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const last = useRef(0);
  const { pathname } = useLocation();
  const nav = useNavigate();

  const load = useCallback((force = false) => {
    if (!user) return;
    if (!force && Date.now() - last.current < 60000) return;
    last.current = Date.now();
    notif("feed").then(setData).catch(() => {});
  }, [user]);

  useEffect(() => { if (user) load(true); else setData(null); }, [user?.id]);
  useEffect(() => { load(false); }, [pathname, load]);
  useEffect(() => {
    if (!user) return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") load(true); }, POLL);
    const f = () => load(false);
    const r = () => load(true);
    window.addEventListener("focus", f);
    window.addEventListener(NOTIF_REFRESH, r);
    window.addEventListener(ANN_SEEN, r);
    return () => { clearInterval(t); window.removeEventListener("focus", f); window.removeEventListener(NOTIF_REFRESH, r); window.removeEventListener(ANN_SEEN, r); };
  }, [user, load]);

  if (!user) return null;
  const items = data?.items || [];
  const unread = data?.unread || 0;

  const patchItem = (key, fn) => setData((d) => d && ({ ...d, items: fn(d.items), unread: fn(d.items).filter((x) => x.unread).length }));
  const openItem = (x) => {
    if (x.unread) { patchItem(x.key, (list) => list.map((i) => (i.key === x.key ? { ...i, unread: false } : i))); notif("read", { key: x.key }).catch(() => {}); }
    setOpen(false);
    if (/^https:\/\//.test(x.link)) window.open(x.link, "_blank", "noopener,noreferrer");
    else nav(x.link || "/konto");
  };
  const hide = (x) => { patchItem(x.key, (list) => list.filter((i) => i.key !== x.key)); notif("hide", { key: x.key }).catch(() => {}); };
  const readAll = () => { setData((d) => d && ({ ...d, unread: 0, items: d.items.map((i) => ({ ...i, unread: false })) })); notif("read_all").catch(() => {}); };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) load(true); }}>
      <PopoverTrigger className="relative p-2 gold-text hover:text-[#E2C170] transition-colors" aria-label={unread ? `Powiadomienia: ${unread} nowe` : "Powiadomienia"} title="Powiadomienia">
        <Bell className="h-5 w-5" strokeWidth={1.25} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#C9A24A] text-[#0A0A0B] text-[10px] font-mono leading-4 text-center rounded-full" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12}
        className="w-[min(92vw,400px)] p-0 rounded-none border border-[#3D3D3F] bg-[#0D0D0E] text-foreground">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b hairline">
          <p className="technical text-[10px] gold-text">POWIADOMIENIA{unread ? ` · ${unread} NOWE` : ""}</p>
          {unread > 0 && <button type="button" onClick={readAll} className="technical text-[9px] text-foreground/60 hover:text-foreground underline underline-offset-4 min-h-[32px]">OZNACZ WSZYSTKIE</button>}
        </div>
        <div className="max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain">
          {!data ? (
            <div className="p-4 space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-12 bg-[#141416] animate-pulse motion-reduce:animate-none" />)}</div>
          ) : !items.length ? (
            <p className="p-6 text-sm text-foreground/60 leading-relaxed">Nic nowego. Tu pojawią się nowości ze Skarbca, promocje, spotkania i sprawy Twojego konta.</p>
          ) : (
            <ul>
              {items.map((x) => {
                const Icon = ICON[x.kind] || Bell;
                return (
                  <li key={x.key} className={`group relative border-b hairline last:border-0 ${x.unread ? "bg-[#C9A24A]/[0.05]" : ""}`}>
                    <button type="button" onClick={() => openItem(x)} className="w-full text-left flex gap-3 px-4 py-3 pr-10 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:bg-white/[0.05]">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${x.important ? "text-[#E8C547]" : "text-foreground/50"}`} strokeWidth={1.5} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 technical text-[9px] text-foreground/55">
                          {x.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#C9A24A] shrink-0" aria-label="nowe" />}
                          {LABEL[x.kind] || "Powiadomienie"} · {ago(x.at)}
                        </span>
                        <span className={`block text-sm leading-snug mt-1 ${x.unread ? "text-[#F5EFE1]" : "text-foreground/75"}`}>{x.title}</span>
                        {x.body && <span className="block text-xs text-foreground/55 leading-relaxed mt-1">{x.body}</span>}
                        {x.code && <CodeCopy code={x.code} />}
                      </span>
                    </button>
                    <button type="button" onClick={() => hide(x)} aria-label={`Ukryj: ${x.title}`} title="Ukryj"
                      className="absolute top-2.5 right-2 p-1.5 text-foreground/55 hover:text-foreground md:opacity-0 md:group-hover:opacity-100 focus:opacity-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t hairline px-4 py-2.5 flex items-center justify-between">
          <Link to="/konto?tab=ustawienia#powiadomienia" onClick={() => setOpen(false)} className="technical text-[9px] text-foreground/55 hover:text-foreground inline-flex items-center gap-1.5 min-h-[32px]">
            <Settings className="h-3.5 w-3.5" /> USTAWIENIA POWIADOMIEŃ
          </Link>
          <Link to="/konto" onClick={() => setOpen(false)} className="technical text-[9px] gold-text min-h-[32px] inline-flex items-center">MOJE KONTO →</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}