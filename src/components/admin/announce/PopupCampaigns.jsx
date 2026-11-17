import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, ArrowLeft, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PopupCard, { boxClass } from "@/components/exmortis/popup/PopupCard";
import { toLocal, fromLocal } from "./annForm";

// Panel → Ogłoszenia i popupy → Kampanie popup (wariant M, 17.11.2026).
// Wiele kampanii, ale odwiedzający widzi najwyżej jeden popup w wizycie (priorytet 1 = najważniejszy).
const api = (action, extra = {}) => base44.functions.invoke("adminSettings", { action, ...extra }).then((r) => r.data);
const errOf = (e) => e?.response?.data?.error || e?.message || "Coś poszło nie tak.";

const RODZAJE = [
  ["produkt", "Produkt", "Sprzedaż lub darmowy materiał ze Sklepu"],
  ["spotkanie", "Spotkanie", "Zaproszenie na wydarzenie z bazy"],
  ["rabat", "Rabat", "Istniejący kod rabatowy"],
  ["info", "Ogłoszenie", "Komunikat bez sprzedaży"],
  ["listy", "Listy Powrotu", "Zachęta do zapisu na newsletter"],
];
const RODZAJ_LABEL = Object.fromEntries(RODZAJE.map(([k, l]) => [k, l]));
const STATUS = {
  aktywna: ["Aktywna", "bg-emerald-500/15 text-emerald-300"],
  zaplanowana: ["Zaplanowana", "bg-[#C9A24A]/15 text-[#E2C27A]"],
  szkic: ["Szkic", "bg-white/10 text-foreground/75"],
  wstrzymana: ["Wstrzymana", "bg-white/10 text-foreground/60"],
  zakonczona: ["Zakończona", "bg-white/5 text-foreground/45"],
  czeka: ["Czeka na kod", "bg-[#E8C547]/15 text-[#E8C547]"],
};
const KOMU = { wszyscy: "Wszyscy", goscie: "Niezalogowani", zalogowani: "Zalogowani" };
const GDZIE = { wszedzie: "Cała witryna", glowna: "Strona główna", sklep: "Sklep", wybrane: "Wybrane strony" };
const PRIO = [[1, "1 — komunikat krytyczny"], [2, "2 — wydarzenie"], [3, "3 — promocja"], [4, "4 — nowość"], [5, "5 — dodatkowy"]];
const AKCJE = {
  produkt: [["produkt", "Przejdź do produktu"], ["link", "Otwórz link"], ["zamknij", "Zamknij"]],
  spotkanie: [["spotkanie", "Przejdź do zapisu"], ["link", "Otwórz link"]],
  rabat: [["produkt_kod", "Przejdź do produktu z kodem"], ["link", "Otwórz link (kod zapamiętany)"], ["kopiuj", "Tylko kopiuj kod"]],
  info: [["zamknij", "Przycisk „Rozumiem”"], ["link", "Otwórz link"], ["brak", "Bez przycisku"]],
  listy: [["listy", "Przejdź do zapisu"]],
};
const EMPTY = {
  nazwa: "", rodzaj: "produkt", status: "szkic", priorytet: 3, od: null, do: null, komu: "wszyscy",
  ukryj_posiadaczy: true, bez_subskrybentow: false, gdzie: "wszedzie", sciezki: [], etykieta: "", tytul: "", tresc: "",
  przycisk_napis: "", akcja: "produkt", przycisk_link: "", produkt_id: "", wydarzenie_id: "", kod: "",
  opoznienie: 15, przewiniecie: 0, cisza_zamkniecie: 7, cisza_klik: 0,
};

const INPUT = "w-full rounded-lg bg-[#0D0D0E] border border-white/12 px-3 py-2.5 text-sm text-[#F1EDE3] focus:border-[#C9A24A] focus-visible:outline-none";
const LABEL = "block text-xs text-foreground/60 mb-1.5";
const CARD = "rounded-xl border border-white/[.07] bg-[#111113] p-4 sm:p-5";
const fmtD = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const fmtDay = (ymd) => (ymd ? String(ymd).split("-").reverse().join(".") : "");
const zl = (n) => `${Number(n).toFixed(2).replace(".", ",").replace(",00", "")} zł`;
const kodOpis = (c) => `${c.kind === "procent" ? `−${c.value}%` : `−${c.value} zł`}`;

// Status widoczny w panelu: aktywna z datą „od” w przyszłości = zaplanowana; po dacie „do” = zakończona.
// Aktywna kampania z kodem, który teraz nie działa (np. „tylko cena regularna” w czasie promocji) = czeka na kod.
const viewStatus = (k, kody = []) => {
  const now = Date.now();
  const c = k.kod ? kody.find((x) => x.kod === k.kod) : null;
  if (k.status === "aktywna" && k.kod && (!c || !c.ok) && !(k.do && Date.parse(k.do) < now)) return "czeka";
  if (k.status === "aktywna" && k.do && Date.parse(k.do) < now) return "zakonczona";
  if (k.status === "aktywna" && k.od && Date.parse(k.od) > now) return "zaplanowana";
  return k.status;
};
const period = (k) => (k.od || k.do ? `${k.od ? fmtD(k.od) : "teraz"} – ${k.do ? fmtD(k.do) : "bez końca"}` : "bez końca");

// Kształt jak z serwera (publiczny), żeby podgląd w panelu wyglądał tak samo jak na stronie.
// Kod z ustawieniami z edytora (zanim zostaną zapisane) i jego stan „działa teraz”.
const todayPl = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
function effCode(code, ks, prod) {
  if (!code) return null;
  const c = ks ? { ...code, bez_promocji: !ks.od_promocji, od: ks.od || null, valid_until: ks.do || null } : code;
  const t = todayPl();
  const dates = (!c.od || c.od <= t) && (!c.valid_until || c.valid_until >= t);
  const regular = c.bez_promocji && (prod ? prod.cena < prod.cena_regularna : /regularnej/.test(code.powod || ""));
  const other = !code.ok && !/regularnej|działa od|wygasł/i.test(code.powod || "");
  const ok = c.active !== false && dates && !regular && !other;
  const powod = ok ? "" : other ? code.powod : !dates ? (c.od && c.od > t ? `Kod działa od ${fmtDay(c.od)}` : "Kod wygasł") : "Kod działa tylko w cenie regularnej (teraz trwa promocja)";
  return { ...c, ok, powod };
}

function previewOf(f, opt, ks) {
  const p = opt.products.find((x) => x.id === f.produkt_id);
  const e = opt.events.find((x) => x.id === f.wydarzenie_id);
  const c = effCode(opt.kody.find((x) => x.kod === f.kod), ks, p);
  let cenaPo = null;
  if (p && c?.ok) {
    const fits = (!c.product_ids?.length || c.product_ids.map(String).includes(p.id)) && !(c.bez_promocji && p.cena < p.cena_regularna);
    if (fits) cenaPo = Math.max(0, Math.round((p.cena - (c.kind === "kwota" ? Math.min(p.cena, Number(c.value)) : (p.cena * Math.min(100, Number(c.value))) / 100)) * 100) / 100);
  }
  return {
    ...f, href: f.akcja === "zamknij" || f.akcja === "brak" ? "" : "/",
    kod: c?.ok ? f.kod : "", kod_dla: c?.tylko_subskrybenci ? "subskrybenci" : c?.tylko_konto ? "konto" : "",
    produkt: p ? { id: p.id, nazwa: p.name, cena: p.cena, cena_regularna: p.cena_regularna, cena_po: cenaPo, obraz: p.obraz } : null,
    spotkanie: e ? { id: e.id, tytul: e.title, start: e.start, format: e.format, bezplatne: e.bezplatne } : null,
  };
}

export default function PopupCampaigns() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState("wszystkie");
  const load = () => api("get_popups").then(setData).catch((e) => setErr(errOf(e)));
  useEffect(() => { load(); }, []);

  const act = async (id, op) => {
    setBusy(true); setErr("");
    try { await api("popup_action", { id, op }); await load(); } catch (e) { setErr(errOf(e)); } finally { setBusy(false); }
  };

  if (!data) return err ? <p role="alert" className="text-sm blood-text">{err}</p> : <Loader2 className="h-5 w-5 animate-spin gold-text" aria-label="Wczytuję" />;
  if (edit) {
    return <CampaignEditor initial={edit} opt={data} onBack={() => setEdit(null)} onSaved={async () => { await load(); }} />;
  }

  const stat = Object.fromEntries((data.stats || []).map((s) => [s.kampania, s]));
  const sale = Object.fromEntries((data.sales || []).map((s) => [s.kod, s]));
  const items = data.items.map((k) => ({ ...k, vs: viewStatus(k, data.kody) }));
  const kodOf = (k) => data.kody.find((x) => x.kod === k.kod);
  const count = (st) => items.filter((k) => k.vs === st).length;
  const shown = filter === "wszystkie" ? items : items.filter((k) => k.vs === filter);
  const live = items.filter((k) => k.vs === "aktywna").sort((a, b) => a.priorytet - b.priorytet);
  const FILTERS = [["wszystkie", `Wszystkie (${items.length})`], ["aktywna", `Aktywne (${count("aktywna")})`], ["zaplanowana", `Zaplanowane (${count("zaplanowana")})`],
    ["czeka", `Czekają na kod (${count("czeka")})`], ["szkic", `Szkice (${count("szkic")})`], ["wstrzymana", `Wstrzymane (${count("wstrzymana")})`], ["zakonczona", `Zakończone (${count("zakonczona")})`]];

  return (
    <section className="space-y-4" aria-labelledby="kp-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="technical text-[10px] tracking-[.14em] gold-text">POPUPY NA STRONIE</p>
          <h2 id="kp-h" className="relic-heading normal-case text-2xl sm:text-3xl text-[#F1EDE3]">Kampanie popup</h2>
        </div>
        <button type="button" className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-lg bg-[#C9A24A] text-[#0A0A0B] font-semibold text-sm hover:bg-[#E2C27A]" onClick={() => setEdit({ ...EMPTY })}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Nowa kampania
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filtr kampanii">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`flex-none min-h-[36px] px-3.5 rounded-full text-[13px] border ${filter === k ? "border-[#C9A24A]/60 bg-[#C9A24A]/15 text-[#F1EDE3]" : "border-white/12 text-foreground/65 hover:text-foreground"}`}>{l}</button>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-[#C9A24A]/30 bg-[#C9A24A]/[.06] px-4 py-3 text-sm">
        <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${live.length ? "bg-emerald-300" : "bg-white/30"}`} aria-hidden="true" />
        <span className="text-foreground/80">
          {live.length ? <>Teraz na stronie: <strong className="text-[#F1EDE3] font-semibold">{live[0].nazwa}</strong> · {KOMU[live[0].komu]?.toLowerCase()} · {GDZIE[live[0].gdzie]?.toLowerCase()} · {live[0].do ? `do ${fmtD(live[0].do)}` : "bez końca"}
            {live.length > 1 && <span className="text-foreground/55"> (+{live.length - 1} w kolejce — pokażą się tam, gdzie pierwsza nie pasuje)</span>}</>
            : "Żadna kampania nie jest teraz aktywna."}
        </span>
      </div>

      {err && <p role="alert" className="text-sm blood-text">{err}</p>}

      {!shown.length ? <p className="text-sm text-foreground/55">Brak kampanii w tym widoku.</p> : (
        <ul className="space-y-2.5">
          {shown.map((k) => {
            const s = stat[k.id] || {};
            const ctr = s.wysw ? `${Math.round((s.klik / s.wysw) * 1000) / 10}%` : "—";
            const sl = k.kod ? sale[k.kod] : null;
            const [stL, stC] = STATUS[k.vs] || STATUS.szkic;
            return (
              <li key={k.id} className={`${CARD} !p-0`}>
                <div className="grid gap-3 p-4 lg:grid-cols-[2.2fr_1fr_1.3fr_1.2fr_1.6fr] lg:items-center">
                  <button type="button" onClick={() => setEdit(k)} className="text-left min-w-0">
                    <span className="block font-semibold text-[#F1EDE3] hover:text-[#E2C27A] truncate">{k.nazwa}</span>
                    <span className="block text-xs text-foreground/55 truncate">{RODZAJ_LABEL[k.rodzaj]}{k.kod ? ` · kod ${k.kod}` : ""} · priorytet {k.priorytet}</span>
                    {k.vs === "czeka" && <span className="block text-xs text-[#E8C547] mt-0.5">Niewidoczna: {kodOf(k)?.powod || "kod nie istnieje"}. Pokaże się sama, gdy kod zacznie działać.</span>}
                  </button>
                  <span><span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${stC}`}>{stL}</span></span>
                  <span className="text-[13px] text-foreground/65">{period(k)}</span>
                  <span className="text-[13px] text-foreground/65">{KOMU[k.komu]} · {GDZIE[k.gdzie]}</span>
                  <span className="text-[13px] text-foreground/75">
                    {s.wysw ? <>{s.wysw} wyśw. · {s.klik} klik. · {ctr}</> : <span className="text-foreground/45">brak wyświetleń</span>}
                    {k.kod && <span className="block text-xs text-foreground/50">{sl ? `${sl.ile} opłac. zamówień z kodem · ${zl(sl.suma)}` : "0 opłaconych zamówień z kodem"}</span>}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 border-t border-white/[.05] px-3 py-2">
                  <RowBtn onClick={() => setEdit(k)}>Edytuj</RowBtn>
                  <RowBtn disabled={busy} onClick={() => act(k.id, "duplikuj")}>Duplikuj</RowBtn>
                  {k.status === "aktywna" && <RowBtn disabled={busy} onClick={() => act(k.id, "wstrzymaj")}>Wstrzymaj</RowBtn>}
                  {(k.status === "wstrzymana" || k.status === "szkic") && <RowBtn disabled={busy} onClick={() => act(k.id, "wznow")}>{k.status === "szkic" ? "Włącz" : "Wznów"}</RowBtn>}
                  {k.status !== "zakonczona" && k.status !== "szkic" && <RowBtn disabled={busy} onClick={() => act(k.id, "zakoncz")}>Zakończ</RowBtn>}
                  {k.status === "szkic" && <RowBtn disabled={busy} onClick={() => act(k.id, "usun")}>Usuń szkic</RowBtn>}
                  {k.vs === "aktywna" && <a href={`/?popup=${k.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md text-[13px] gold-text hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Podgląd na stronie</a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-foreground/50 max-w-[80ch]">Liczniki działają od wdrożenia kampanii (17.11.2026), bez danych osobowych. Wynik rabatu = opłacone zamówienia z tym kodem (z bazy zamówień, bez testowych). Zawsze wyłączone: kasa, płatności, potwierdzenia, strony prawne, panel, test, Cisza oraz strona, do której prowadzi przycisk.</p>
    </section>
  );
}

const RowBtn = ({ children, ...p }) => (
  <button type="button" {...p} className="min-h-[36px] px-3 rounded-md text-[13px] text-foreground/75 hover:text-foreground hover:bg-white/5 disabled:opacity-50">{children}</button>
);

function Section({ n, title, children }) {
  return (
    <section className={CARD}>
      <h3 className="relic-heading normal-case text-lg text-[#F1EDE3] mb-3">{n}. {title}</h3>
      {children}
    </section>
  );
}

function CampaignEditor({ initial, opt, onBack, onSaved }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [warn, setWarn] = useState("");
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setRodzaj = (r) => setF((x) => ({ ...x, rodzaj: r, akcja: AKCJE[r][0][0], ukryj_posiadaczy: r === "produkt" || r === "rabat", bez_subskrybentow: r === "listy" }));
  const prod = opt.products.find((p) => p.id === f.produkt_id);
  const rawCode = opt.kody.find((c) => c.kod === f.kod);
  // Ustawienia kodu edytowane w kampanii (zapisują się do kodu przy zapisie kampanii).
  const [ks, setKs] = useState(null);
  const ksFrom = (c) => (c ? { od_promocji: !c.bez_promocji, od: c.od || "", do: c.valid_until || "" } : null);
  useEffect(() => { setKs(ksFrom(rawCode)); }, [f.kod, rawCode?.bez_promocji, rawCode?.od, rawCode?.valid_until]);  
  const ksDirty = !!(ks && rawCode && JSON.stringify(ks) !== JSON.stringify(ksFrom(rawCode)));
  const code = effCode(rawCode, ks, prod);
  const pv = useMemo(() => previewOf(f, opt, ks), [f, opt, ks]);
  const needsProduct = f.rodzaj === "produkt" || (f.rodzaj === "rabat" && f.akcja === "produkt_kod");

  const save = async (status) => {
    setBusy(true); setErr(""); setMsg(""); setWarn("");
    try {
      const r = await api("save_popup", { data: { ...f, status: status || f.status }, ...(ksDirty ? { kod_ustawienia: ks } : {}) });
      setF((x) => ({ ...x, ...r.item }));
      setWarn(r.ostrzezenie || "");
      setMsg(r.item.status === "aktywna" ? "Zapisane i włączone. Na stronie w ciągu ok. 2 minut." : "Zapisane.");
      await onSaved();
    } catch (e) { setErr(errOf(e)); } finally { setBusy(false); }
  };

  const summary = (() => {
    const who = { wszyscy: "wszyscy odwiedzający", goscie: "niezalogowani", zalogowani: "zalogowani" }[f.komu];
    const extra = [f.ukryj_posiadaczy && prod ? `bez osób, które mają „${prod.name}”` : "", f.bez_subskrybentow ? "bez subskrybentów Listów Powrotu" : "",
      f.rodzaj === "spotkanie" ? "bez osób już zapisanych" : ""].filter(Boolean).join(", ");
    const where = { wszedzie: "na całej witrynie (bez stron wyłączonych)", glowna: "tylko na stronie głównej", sklep: "tylko w Sklepie", wybrane: `na stronach: ${f.sciezki.join(", ") || "—"}` }[f.gdzie];
    const when = f.od || f.do ? `${f.od ? `od ${fmtD(f.od)}` : "od teraz"}${f.do ? ` do ${fmtD(f.do)}` : ""}` : "bez daty końca";
    const quiet = f.cisza_zamkniecie ? `po zamknięciu wraca po ${f.cisza_zamkniecie} ${f.cisza_zamkniecie === 1 ? "dniu" : "dniach"}` : "po zamknięciu nie wraca do końca kampanii";
    return `Ten popup zobaczą: ${who}${extra ? ` (${extra})` : ""}, ${where}, ${when}. Najwyżej raz na wizytę; ${quiet}.`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 min-h-[40px] text-sm gold-text"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kampanie popup</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => save(f.status === "aktywna" ? "aktywna" : "szkic")} className="min-h-[42px] px-4 rounded-lg border border-white/15 text-sm text-[#F1EDE3] hover:bg-white/5 disabled:opacity-50">
            {f.status === "aktywna" ? "Zapisz zmiany" : "Zapisz jako szkic"}
          </button>
          {f.status !== "aktywna" && (
            <button type="button" disabled={busy} onClick={() => save("aktywna")} className="min-h-[42px] px-4 rounded-lg bg-[#C9A24A] text-[#0A0A0B] font-semibold text-sm hover:bg-[#E2C27A] disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Zapisuję" /> : "Zapisz i włącz"}
            </button>
          )}
        </div>
      </div>
      <label className="block max-w-xl"><span className={LABEL}>Nazwa kampanii (widoczna tylko w panelu)</span>
        <input className={INPUT} maxLength={80} value={f.nazwa} onChange={(e) => set("nazwa", e.target.value)} placeholder="np. Wracam inny — cena regularna, kod INNY20" /></label>
      {msg && <p role="status" className="text-sm gold-text">{msg}</p>}
      {warn && <p role="alert" className="text-sm text-[#E8C547]">{warn}</p>}
      {err && <p role="alert" className="text-sm blood-text">{err}</p>}

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full space-y-4">
          <Section n={1} title="Rodzaj kampanii">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2" role="radiogroup" aria-label="Rodzaj kampanii">
              {RODZAJE.map(([k, l, d]) => (
                <button key={k} type="button" role="radio" aria-checked={f.rodzaj === k} onClick={() => setRodzaj(k)}
                  className={`text-left rounded-lg border p-3 ${f.rodzaj === k ? "border-[#C9A24A]/60 bg-[#C9A24A]/10" : "border-white/10 hover:border-white/25"}`}>
                  <span className="block text-sm font-semibold text-[#F1EDE3]">{l}</span>
                  <span className="block text-xs text-foreground/55 mt-0.5">{d}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section n={2} title="Powiązanie z bazą">
            <div className="grid sm:grid-cols-2 gap-3">
              {(needsProduct || f.rodzaj === "rabat") && (
                <label><span className={LABEL}>Produkt {f.rodzaj === "rabat" && f.akcja !== "produkt_kod" ? "(opcjonalnie — do ceny w popupie)" : ""}</span>
                  <select className={INPUT} value={f.produkt_id} onChange={(e) => set("produkt_id", e.target.value)}>
                    <option value="">— wybierz —</option>
                    {opt.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.cena > 0 ? zl(p.cena) : "bezpłatny"}{p.cena < p.cena_regularna ? ` (regularnie ${zl(p.cena_regularna)})` : ""}</option>)}
                  </select></label>
              )}
              {f.rodzaj === "spotkanie" && (
                <label className="sm:col-span-2"><span className={LABEL}>Spotkanie (opublikowane, przyszłe)</span>
                  <select className={INPUT} value={f.wydarzenie_id} onChange={(e) => set("wydarzenie_id", e.target.value)}>
                    <option value="">— wybierz —</option>
                    {opt.events.map((e) => <option key={e.id} value={e.id}>{e.title} · {fmtD(e.start)}{e.bezplatne ? " · bezpłatne" : ""}</option>)}
                  </select>
                  {!opt.events.length && <span className="block text-xs text-foreground/50 mt-1">Brak opublikowanych przyszłych spotkań.</span>}</label>
              )}
              {(f.rodzaj === "rabat" || f.rodzaj === "produkt") && (
                <label><span className={LABEL}>Kod rabatowy {f.rodzaj === "produkt" ? "(opcjonalnie)" : ""}</span>
                  <select className={INPUT} value={f.kod} onChange={(e) => set("kod", e.target.value)}>
                    <option value="">{f.rodzaj === "produkt" ? "— bez kodu —" : "— wybierz —"}</option>
                    {opt.kody.filter((c) => c.active || c.kod === f.kod).map((c) => <option key={c.kod} value={c.kod}>{c.kod} · {kodOpis(c)}{c.ok ? "" : ` · ${c.powod}`}</option>)}
                  </select></label>
              )}
            </div>
            {code && (
              <div className={`mt-3 rounded-lg border px-3 py-2.5 text-[13px] ${code.ok ? "border-emerald-400/30 bg-emerald-400/5 text-foreground/80" : "border-[#E8C547]/40 bg-[#E8C547]/5 text-foreground/80"}`}>
                <strong className={code.ok ? "text-emerald-300" : "text-[#E8C547]"}>{code.ok ? "Kod działa" : `Kod nie działa teraz: ${code.powod}`}</strong>
                <span className="block mt-0.5 text-foreground/65">
                  {kodOpis(code)}{code.od ? ` · od ${fmtDay(code.od)}` : ""}{code.valid_until ? ` · do ${fmtDay(code.valid_until)}` : " · bez daty końca"}
                  {code.bez_promocji ? " · tylko cena regularna" : ""}{code.tylko_subskrybenci ? " · tylko subskrybenci Listów Powrotu" : ""}{code.tylko_konto ? " · tylko z kontem" : ""}
                  {pv.produkt?.cena_po != null ? ` · w popupie: ${zl(pv.produkt.cena_po)} zamiast ${zl(pv.produkt.cena)}` : ""}
                  {prod && code.ok && pv.produkt?.cena_po == null ? " · na wybrany produkt teraz nie działa (np. trwa promocja)" : ""}
                </span>
                {!code.ok && <span className="block mt-1 text-xs text-foreground/55">Kampania z takim kodem nie pokaże się na stronie, dopóki kod nie zacznie działać — włącza się wtedy sama.</span>}
              </div>
            )}
            {code && ks && (
              <div className="mt-3 rounded-lg border border-white/10 p-3 space-y-3">
                <p className="text-xs text-foreground/60">Ustawienia kodu {f.kod} <span className="text-foreground/45">(zmieniają kod wszędzie — w kasie i w innych kampaniach; zapisują się razem z kampanią)</span></p>
                <label className="flex items-start gap-2 text-sm text-foreground/85 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 mt-0.5 accent-[#C9A24A]" checked={ks.od_promocji} onChange={(e) => setKs({ ...ks, od_promocji: e.target.checked })} />
                  <span>Kod działa też od ceny promocyjnej <span className="text-foreground/50">(promocja na promocję — np. 69 zł − 20%)</span></span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label><span className={LABEL}>Kod ważny od</span>
                    <input type="date" className={INPUT} value={ks.od} onChange={(e) => setKs({ ...ks, od: e.target.value })} /></label>
                  <label><span className={LABEL}>Kod ważny do (włącznie)</span>
                    <input type="date" className={INPUT} value={ks.do} onChange={(e) => setKs({ ...ks, do: e.target.value })} /></label>
                </div>
                {ksDirty && <p className="text-xs text-[#E2C27A]">Zmiany kodu zapiszą się po kliknięciu „Zapisz”.</p>}
              </div>
            )}
            {f.rodzaj === "spotkanie" && <p className="mt-3 text-xs text-foreground/55">Tytuł i termin pobierane ze spotkania. Kampania gaśnie sama, gdy spotkanie minie albo zapisy się zamkną. Zalogowani zapisani nie zobaczą zaproszenia.</p>}
            {f.rodzaj === "info" && <p className="text-xs text-foreground/55">Ogłoszenie nie wymaga powiązania.</p>}
            {f.rodzaj === "listy" && <p className="text-xs text-foreground/55">Przycisk prowadzi do istniejącego zapisu na Listy Powrotu (dobrowolna zgoda i potwierdzenie e-mailem). Zamknięcie popupu nie jest zgodą.</p>}
          </Section>

          <Section n={3} title="Treść">
            <div className="grid sm:grid-cols-2 gap-3">
              <label><span className={LABEL}>Etykieta (opcjonalnie)</span>
                <input className={INPUT} maxLength={60} value={f.etykieta} onChange={(e) => set("etykieta", e.target.value)} placeholder="np. Oferta do 6 grudnia" /></label>
              <label><span className={LABEL}>Nagłówek{f.rodzaj === "spotkanie" ? " (puste = tytuł spotkania)" : ""}</span>
                <input className={INPUT} maxLength={120} value={f.tytul} onChange={(e) => set("tytul", e.target.value)} /></label>
              <label className="sm:col-span-2"><span className={LABEL}>Treść (krótko: 1–3 zdania)</span>
                <textarea className={INPUT} rows={4} maxLength={800} value={f.tresc} onChange={(e) => set("tresc", e.target.value)} />
                <span className="block text-right text-[11px] text-foreground/45 mt-1">{f.tresc.length}/800</span></label>
              <label><span className={LABEL}>Akcja przycisku</span>
                <select className={INPUT} value={f.akcja} onChange={(e) => set("akcja", e.target.value)}>
                  {AKCJE[f.rodzaj].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              {f.akcja !== "brak" && f.akcja !== "kopiuj" && (
                <label><span className={LABEL}>Napis na przycisku</span>
                  <input className={INPUT} maxLength={40} value={f.przycisk_napis} onChange={(e) => set("przycisk_napis", e.target.value)} placeholder="np. Zobacz w Sklepie" /></label>
              )}
              {f.akcja === "link" && (
                <label className="sm:col-span-2"><span className={LABEL}>Adres przycisku</span>
                  <input className={INPUT} maxLength={500} value={f.przycisk_link} onChange={(e) => set("przycisk_link", e.target.value)} placeholder="/skarbiec/… albo https://…" /></label>
              )}
            </div>
          </Section>

          <Section n={4} title="Komu i gdzie">
            <div className="grid sm:grid-cols-2 gap-3">
              <label><span className={LABEL}>Odbiorcy</span>
                <select className={INPUT} value={f.komu} onChange={(e) => set("komu", e.target.value)}>
                  <option value="wszyscy">Wszyscy odwiedzający</option><option value="goscie">Tylko niezalogowani</option><option value="zalogowani">Tylko zalogowani</option>
                </select></label>
              <label><span className={LABEL}>Priorytet (1 = najważniejszy)</span>
                <select className={INPUT} value={f.priorytet} onChange={(e) => set("priorytet", Number(e.target.value))}>
                  {PRIO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select></label>
              <label><span className={LABEL}>Gdzie</span>
                <select className={INPUT} value={f.gdzie} onChange={(e) => set("gdzie", e.target.value)}>
                  {Object.entries(GDZIE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              {f.gdzie === "wybrane" && (
                <label><span className={LABEL}>Strony (po przecinku)</span>
                  <input className={INPUT} value={f.sciezki.join(", ")} onChange={(e) => set("sciezki", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="/skarbiec/wracam-inny, /o-mnie" /></label>
              )}
              <div className="sm:col-span-2 flex flex-col gap-2 text-sm text-foreground/80">
                {f.produkt_id && (
                  <label className="inline-flex items-center gap-2 min-h-[36px]"><input type="checkbox" className="h-4 w-4 accent-[#C9A24A]" checked={f.ukryj_posiadaczy} onChange={(e) => set("ukryj_posiadaczy", e.target.checked)} />
                    Ukryj przed zalogowanymi, którzy mają już ten produkt</label>
                )}
                <label className="inline-flex items-center gap-2 min-h-[36px]"><input type="checkbox" className="h-4 w-4 accent-[#C9A24A]" checked={f.bez_subskrybentow} onChange={(e) => set("bez_subskrybentow", e.target.checked)} />
                  Ukryj przed subskrybentami Listów Powrotu</label>
              </div>
            </div>
          </Section>

          <Section n={5} title="Kiedy">
            <div className="grid sm:grid-cols-2 gap-3">
              <label><span className={LABEL}>Od (puste = od włączenia)</span>
                <input type="datetime-local" className={INPUT} value={toLocal(f.od)} onChange={(e) => set("od", fromLocal(e.target.value))} /></label>
              <label><span className={LABEL}>Do (puste = bez końca)</span>
                <input type="datetime-local" className={INPUT} value={toLocal(f.do)} onChange={(e) => set("do", fromLocal(e.target.value))} /></label>
              <label><span className={LABEL}>Pokaż po (sekundach)</span>
                <input type="number" min={0} max={120} className={INPUT} value={f.opoznienie} onChange={(e) => set("opoznienie", Number(e.target.value))} /></label>
              <label><span className={LABEL}>Dopiero po przewinięciu strony</span>
                <select className={INPUT} value={f.przewiniecie} onChange={(e) => set("przewiniecie", Number(e.target.value))}>
                  <option value={0}>Bez warunku</option><option value={30}>30% strony</option><option value={50}>50% strony</option>
                </select></label>
              <label><span className={LABEL}>Po zamknięciu wycisz na</span>
                <select className={INPUT} value={f.cisza_zamkniecie} onChange={(e) => set("cisza_zamkniecie", Number(e.target.value))}>
                  <option value={1}>1 dzień</option><option value={7}>7 dni</option><option value={30}>30 dni</option><option value={0}>Do końca kampanii</option>
                </select></label>
              <label><span className={LABEL}>Po kliknięciu wycisz na</span>
                <select className={INPUT} value={f.cisza_klik} onChange={(e) => set("cisza_klik", Number(e.target.value))}>
                  <option value={0}>Do końca kampanii</option><option value={7}>7 dni</option><option value={30}>30 dni</option>
                </select></label>
            </div>
          </Section>
        </div>

        <aside className="w-full xl:w-[400px] xl:sticky xl:top-4 space-y-4" aria-label="Podgląd i podsumowanie">
          <div className={CARD}>
            <p className="technical text-[10px] tracking-[.14em] text-foreground/55 mb-2">PODSUMOWANIE</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
          </div>
          <div className="rounded-xl border border-white/[.07] bg-[radial-gradient(120%_90%_at_50%_0%,#1A1712,#050506_70%)] p-4">
            <p className="technical text-[10px] tracking-[.14em] text-foreground/55 mb-3">PODGLĄD</p>
            <div className={boxClass(pv)} aria-hidden="true">
              <PopupCard k={pv} static close={() => {}} clicked={() => {}} copy={() => {}} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
