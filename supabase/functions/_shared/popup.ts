import { runSql, escStr } from "./supabase.ts";
import { unitPrice, warsawToday } from "./productPrice.ts";
import { accessFilter } from "./mirror.ts";
import { isActive } from "./access.ts";

// Popup na stronie (Panel → Ogłoszenia → Popup): krótka informacja dla odwiedzających,
// np. o nadchodzącym spotkaniu albo kodzie rabatowym. Ustawienie publiczne (app_settings: "popup").
// Każdy zapis podnosi wersję — odwiedzający, którzy zamknęli poprzedni popup, zobaczą nowy.
export const POPUP_DEFAULT = {
  aktywny: false, tytul: "", tresc: "", przycisk_napis: "", przycisk_link: "", kod: "",
  od: null, do: null, komu: "wszyscy", opoznienie: 8, wersja: 0,
};

const str = (v: unknown, n: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, n);
const iso = (v: unknown) => {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
// Link: adres na stronie (/...) albo https:// — nic innego (bez javascript: i podobnych).
const link = (v: unknown) => {
  const s = str(v, 500);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try { const u = new URL(s); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; }
};

export function cleanPopup(data: any, prevVersion = 0) {
  const d = data || {};
  const komu = ["wszyscy", "goscie", "zalogowani"].includes(d.komu) ? d.komu : "wszyscy";
  const op = Math.round(Number(d.opoznienie));
  return {
    aktywny: d.aktywny === true,
    tytul: str(d.tytul, 120),
    tresc: str(d.tresc, 800),
    przycisk_napis: str(d.przycisk_napis, 40),
    przycisk_link: link(d.przycisk_link),
    kod: str(d.kod, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
    od: iso(d.od),
    do: iso(d.do),
    komu,
    opoznienie: Number.isFinite(op) ? Math.max(0, Math.min(60, op)) : 8,
    wersja: (Number(prevVersion) || 0) + 1,
  };
}

// Publicznie tylko popup, który jest włączony i ma treść (daty sprawdza przeglądarka z czasem serwera).
export function publicPopup(p: any) {
  const v = { ...POPUP_DEFAULT, ...(p || {}) };
  if (!v.aktywny || !(v.tytul || v.tresc)) return null;
  return v;
}

// =====================================================================================
// KAMPANIE POPUP (17.11.2026) — lista kampanii zamiast jednego popupu (app_settings: "popup_kampanie").
// Odwiedzający widzi najwyżej JEDEN popup na wizytę: najniższy numer priorytetu, przy remisie nowsza kampania.
// Produkt, spotkanie i kod rabatowy są czytane z bazy przy każdym odświeżeniu (cena, termin, ważność) —
// kampania z nieważnym kodem albo zamkniętymi zapisami sama znika ze strony.
// =====================================================================================
export const RODZAJE = ["produkt", "spotkanie", "rabat", "info", "listy"];
export const STATUSY = ["szkic", "aktywna", "wstrzymana", "zakonczona"];
const AKCJE = ["produkt", "produkt_kod", "spotkanie", "link", "kopiuj", "listy", "zamknij", "brak"];
const GDZIE = ["wszedzie", "glowna", "sklep", "wybrane"];
const int = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
const oneOf = (v: unknown, list: string[], def: string) => (list.includes(String(v)) ? String(v) : def);
const uuidish = (v: unknown) => (/^[0-9a-f-]{8,40}$/i.test(String(v || "")) ? String(v) : "");
const path = (v: unknown) => {
  const s = str(v, 200);
  return s.startsWith("/") && !s.startsWith("//") ? s.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/" : "";
};

export function cleanCampaign(d: any, prev: any = {}) {
  const now = new Date().toISOString();
  const rodzaj = oneOf(d?.rodzaj, RODZAJE, "info");
  return {
    id: /^[a-z0-9-]{6,40}$/.test(String(prev?.id || d?.id || "")) ? String(prev?.id || d?.id) : `k-${crypto.randomUUID().slice(0, 12)}`,
    nazwa: str(d?.nazwa, 80) || "Kampania bez nazwy",
    rodzaj,
    status: oneOf(d?.status, STATUSY, "szkic"),
    priorytet: int(d?.priorytet, 1, 5, 3),
    od: iso(d?.od), do: iso(d?.do),
    komu: oneOf(d?.komu, ["wszyscy", "goscie", "zalogowani"], "wszyscy"),
    ukryj_posiadaczy: d?.ukryj_posiadaczy === true,
    bez_subskrybentow: d?.bez_subskrybentow === true,
    gdzie: oneOf(d?.gdzie, GDZIE, "wszedzie"),
    sciezki: (Array.isArray(d?.sciezki) ? d.sciezki : []).map(path).filter(Boolean).slice(0, 20),
    etykieta: str(d?.etykieta, 60),
    tytul: str(d?.tytul, 120),
    tresc: str(d?.tresc, 800),
    przycisk_napis: str(d?.przycisk_napis, 40),
    akcja: oneOf(d?.akcja, AKCJE, rodzaj === "info" ? "zamknij" : "link"),
    przycisk_link: link(d?.przycisk_link),
    produkt_id: uuidish(d?.produkt_id),
    wydarzenie_id: uuidish(d?.wydarzenie_id),
    kod: str(d?.kod, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
    opoznienie: int(d?.opoznienie, 0, 120, 15),
    przewiniecie: int(d?.przewiniecie, 0, 90, 0),
    cisza_zamkniecie: int(d?.cisza_zamkniecie, 0, 365, 7),   // dni; 0 = do końca kampanii
    cisza_klik: int(d?.cisza_klik, 0, 365, 0),               // dni; 0 = do końca kampanii
    utworzono: prev?.utworzono || now,
    zmieniono: now,
  };
}

// Obecny pojedynczy popup jako pierwsza kampania — bez zmiany treści, terminu ani statusu.
export function campaignFromLegacy(p: any) {
  const v = { ...POPUP_DEFAULT, ...(p || {}) };
  if (!(v.tytul || v.tresc)) return null;
  return {
    ...cleanCampaign({
      nazwa: "Popup (przeniesiony)", rodzaj: v.kod ? "rabat" : "info", status: v.aktywny ? "aktywna" : "wstrzymana",
      priorytet: 3, od: v.od, do: v.do, komu: v.komu, gdzie: "wszedzie",
      tytul: v.tytul, tresc: v.tresc, przycisk_napis: v.przycisk_napis, akcja: v.przycisk_link ? "link" : "zamknij",
      przycisk_link: v.przycisk_link, kod: v.kod, opoznienie: v.opoznienie, cisza_zamkniecie: 0, cisza_klik: 0,
    }),
    id: "k-przeniesiony",
  };
}

// ---- Weryfikacja kodu dla kampanii (te same zasady co w kasie: discounts.ts) ----
export async function codeInfo(base44, code: string, product: any = null) {
  if (!code) return null;
  const [row] = await runSql(base44, `SELECT data FROM public.exm_discountcode WHERE upper(data->>'code') = ${escStr(code)} LIMIT 1`, true);
  const c = row?.data;
  if (!c) return { ok: false, powod: "Kod nie istnieje" };
  const today = warsawToday();
  if (c.active !== true) return { ok: false, powod: "Kod jest wyłączony", c };
  if (c.od && String(c.od) > today) return { ok: false, powod: `Kod działa od ${c.od}`, c };
  if (c.valid_until && String(c.valid_until) < today) return { ok: false, powod: "Kod wygasł", c };
  if (c.max_uses && (Number(c.uses) || 0) >= Number(c.max_uses)) return { ok: false, powod: "Limit użyć wyczerpany", c };
  if (c.email) return { ok: false, powod: "Kod przypisany do jednego konta", c };
  let cenaPo = null;
  // Kod „tylko cena regularna” bez wskazanego produktu w kampanii: działa, jeśli którykolwiek z jego produktów
  // ma teraz cenę regularną. Gdy wszystkie są w promocji / przedsprzedaży — popup z kodem się nie pokazuje.
  if (!product && c.bez_promocji === true && Array.isArray(c.product_ids) && c.product_ids.length) {
    const rows = await runSql(base44, `SELECT id::text AS id, price::float8 AS price, price_regular::float8 AS price_regular,
        price_start::float8 AS price_start, promo_end_date::text AS promo_end_date, price_steps
      FROM public.products WHERE id::text IN (${c.product_ids.map(escStr).join(",")})`, true);
    const regularNow = rows.some((p) => unitPrice(p) >= Number(p.price_regular ?? p.price));
    if (!regularNow) return { ok: false, powod: "Kod działa tylko w cenie regularnej (teraz trwa promocja)", c };
  }
  if (product) {
    const ids = Array.isArray(c.product_ids) ? c.product_ids.map(String) : [];
    if (ids.length && !ids.includes(String(product.id))) return { ok: false, powod: "Kod nie obejmuje tego produktu", c };
    const typy = Array.isArray(c.typy) ? c.typy.map(String) : [];
    if (typy.length && !typy.includes(String(product.product_type || ""))) return { ok: false, powod: "Kod nie obejmuje tego rodzaju produktu", c };
    const now = Number(product.cena), regular = Number(product.cena_regularna);
    if (c.bez_promocji === true && now < regular) return { ok: false, powod: "Kod działa tylko w cenie regularnej (teraz trwa promocja)", c };
    const off = c.kind === "kwota" ? Math.min(now, Number(c.value)) : Math.round(now * Math.min(100, Number(c.value))) / 100;
    cenaPo = Math.max(0, Math.round((now - off) * 100) / 100);
  }
  return {
    ok: true, c, cenaPo,
    opis: `−${c.value}${c.kind === "procent" ? "%" : " zł"}`,
    dla: c.tylko_subskrybenci === true ? "subskrybenci" : c.tylko_konto === true ? "konto" : "",
  };
}

async function productInfo(base44, id: string) {
  if (!id) return null;
  const [p] = await runSql(base44, `SELECT id::text AS id, name, slug, product_type, status, active, image_url,
      price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
      promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps
    FROM public.products p WHERE id::text = ${escStr(id)}`, true);
  if (!p || p.active === false || ["ukryty"].includes(String(p.status))) return null;
  const cena = unitPrice(p);
  const regular = p.price_regular != null ? Number(p.price_regular) : Number(p.price);
  return { id: p.id, name: p.name, slug: p.slug, product_type: p.product_type, cena, cena_regularna: regular,
    obraz: /^https:\/\//.test(String(p.image_url || "")) ? p.image_url : "", href: `/skarbiec/${p.slug}` };
}

async function eventInfo(base44, id: string) {
  if (!id) return null;
  const [e] = await runSql(base44, `SELECT id::text AS id, title, slug, status, format, start_datetime, price::float8 AS price,
      registration_deadline, registration_type FROM public.events WHERE id::text = ${escStr(id)}`, true);
  if (!e || e.status !== "Opublikowane" || !e.start_datetime) return null;
  const now = Date.now();
  if (Date.parse(e.start_datetime) < now) return null;
  if (e.registration_deadline && Date.parse(e.registration_deadline) < now) return null;
  return { id: e.id, title: e.title, href: `/spotkania/${e.slug}`, start: e.start_datetime, format: e.format, bezplatne: !(Number(e.price) > 0) };
}

let PUB: any = null, PUB_AT = 0, PUB_KEY = "";
// Publiczna lista aktywnych kampanii (bez nazw wewnętrznych i statystyk). Pamięć 60 s na instancję.
export async function publicCampaigns(base44, items: any[]) {
  const key = JSON.stringify((items || []).map((k) => [k.id, k.zmieniono, k.status]));
  if (PUB && key === PUB_KEY && Date.now() - PUB_AT < 60000) return PUB;
  const now = Date.now();
  const out = [];
  for (const k of items || []) {
    if (k.status !== "aktywna") continue;
    if (k.do && Date.parse(k.do) < now) continue;
    if (!(k.tytul || k.tresc)) continue;
    try {
      const prod = (k.rodzaj === "produkt" || k.rodzaj === "rabat" || k.akcja === "produkt" || k.akcja === "produkt_kod") ? await productInfo(base44, k.produkt_id) : null;
      const ev = (k.rodzaj === "spotkanie" || k.akcja === "spotkanie") ? await eventInfo(base44, k.wydarzenie_id) : null;
      if ((k.rodzaj === "produkt") && k.produkt_id && !prod) continue;
      if (k.rodzaj === "spotkanie" && !ev) continue;          // spotkanie minęło albo zapisy zamknięte
      const ci = k.kod ? await codeInfo(base44, k.kod, prod) : null;
      if (k.rodzaj === "rabat" && !ci?.ok) continue;          // kampania rabatowa bez ważnego kodu nie pokazuje się
      const href = k.akcja === "spotkanie" ? ev?.href || "" : (k.akcja === "produkt" || k.akcja === "produkt_kod") ? prod?.href || "" : k.akcja === "listy" ? "/#listy-powrotu" : k.przycisk_link;
      out.push({
        id: k.id, rodzaj: k.rodzaj, priorytet: k.priorytet, zmieniono: k.zmieniono, od: k.od, do: k.do,
        komu: k.komu, ukryj_posiadaczy: k.ukryj_posiadaczy, bez_subskrybentow: k.bez_subskrybentow,
        gdzie: k.gdzie, sciezki: k.sciezki,
        etykieta: k.etykieta, tytul: k.tytul, tresc: k.tresc,
        przycisk_napis: k.przycisk_napis, akcja: k.akcja, href,
        kod: ci?.ok ? k.kod : "", kod_opis: ci?.ok ? ci.opis : "", kod_dla: ci?.ok ? ci.dla : "",
        produkt: prod ? { id: prod.id, nazwa: prod.name, cena: prod.cena, cena_regularna: prod.cena_regularna, cena_po: ci?.ok ? ci.cenaPo : null, obraz: prod.obraz, href: prod.href } : null,
        spotkanie: ev ? { id: ev.id, tytul: ev.title, start: ev.start, format: ev.format, bezplatne: ev.bezplatne, href: ev.href } : null,
        opoznienie: k.opoznienie, przewiniecie: k.przewiniecie, cisza_zamkniecie: k.cisza_zamkniecie, cisza_klik: k.cisza_klik,
      });
    } catch (e) { console.error("popup:", (e as Error)?.message); }
  }
  out.sort((a, b) => a.priorytet - b.priorytet || String(b.zmieniono).localeCompare(String(a.zmieniono)));
  PUB = out; PUB_AT = Date.now(); PUB_KEY = key;
  return out;
}

// Zgodność ze starą wersją strony (przed odświeżeniem przeglądarki): pierwsza kampania w dawnym kształcie.
export function legacyFromCampaigns(list: any[]) {
  const k = (list || []).find((x) => x.gdzie === "wszedzie" && !x.ukryj_posiadaczy && !x.bez_subskrybentow);
  if (!k) return null;
  return { aktywny: true, tytul: k.tytul, tresc: k.tresc, przycisk_napis: k.przycisk_napis, przycisk_link: k.href || "",
    kod: k.kod, od: k.od, do: k.do, komu: k.komu, opoznienie: Math.min(60, k.opoznienie), wersja: Date.parse(k.zmieniono) || 1 };
}

// Dopasowanie do zalogowanej osoby (serwer zna e-mail z sesji): ukrywa kampanię produktu, który ta osoba już ma,
// i kampanie „bez subskrybentów” u osób z potwierdzonym zapisem na Listy Powrotu. Goście dostają listę bez zmian
// (subskrypcję gościa przeglądarka rozpoznaje tylko po własnym zapisie z tej przeglądarki).
export async function forViewer(base44, list: any[], me: any) {
  const email = String(me?.email || "").toLowerCase();
  if (!email || !list?.length) return list || [];
  let sub: boolean | null = null;
  const out = [];
  for (const k of list) {
    if (k.komu === "goscie") continue;
    if (k.bez_subskrybentow) {
      if (sub === null) {
        const [r] = await runSql(base44, `SELECT 1 AS ok FROM public.subscribers WHERE lower(email) = ${escStr(email)} AND status = 'active' LIMIT 1`, true).catch(() => []);
        sub = !!r?.ok;
      }
      if (sub) continue;
    }
    // Zaproszenie na spotkanie: osoba już zapisana go nie dostaje.
    if (k.rodzaj === "spotkanie" && k.spotkanie?.id) {
      const [r] = await runSql(base44, `SELECT 1 AS ok FROM public.registrations WHERE event_id::text = ${escStr(k.spotkanie.id)}
        AND lower(email) = ${escStr(email)} AND status IN ('Zapisany','Obecny') LIMIT 1`, true).catch(() => []);
      if (r?.ok) continue;
    }
    if (k.ukryj_posiadaczy && k.produkt?.id) {
      const acc = await accessFilter(base44, { user_email: email, product_id: String(k.produkt.id) }).catch(() => []);
      if (acc.some(isActive)) continue;
    }
    out.push(k);
  }
  return out;
}
