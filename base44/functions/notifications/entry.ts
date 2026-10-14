import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { runSql, escStr } from "../../shared/supabase.ts";
import { myAnnouncements } from "../../shared/announce.ts";
import { withSteps, unitPrice, warsawToday } from "../../shared/productPrice.ts";
import { libSettings, modeVisible, clientEmail } from "../../shared/libraryAccess.ts";
import { messagesData } from "../../shared/libraryView.ts";

// Powiadomienia zalogowanego klienta (dzwoneczek w nagłówku).
// Lista jest liczona na bieżąco z danych, które już istnieją (produkty, promocje, spotkania, zapisy, dostępy,
// wiadomości, ogłoszenia, ROZDROŻA, Obok) — bez wysyłki i bez kopiowania treści do osobnej tabeli.
// Zapisujemy tylko stan czytania tej osoby (NotificationState: seen_at, read, hidden, prefs).
// Akcje: feed, read {key}, read_all, hide {key}, prefs {prefs}.

const DAY = 864e5;
const NEW_DAYS = 30;          // ile dni „nowość” jest nowością
const DEFAULT_PREFS = { nowosci: true, promocje: true, spotkania: true };
const CAT = { ogloszenie: "zawsze", produkt: "nowosci", wkrotce: "nowosci", historia: "nowosci", promocja: "promocje", kod: "promocje",
  spotkanie: "spotkania", moje_spotkanie: "moje", nagranie: "moje", dostep: "moje", wiadomosc: "moje", obok: "moje",
  lista: "moje", zamowienie: "moje", platnosc: "moje", lekcja: "moje", opinia: "moje" };
const PENDING = ["NEW", "PENDING", "WAITING_FOR_CONFIRMATION"];
const names = (items) => { const n = (Array.isArray(items) ? items : []).map((i) => i?.name).filter(Boolean); return n.length > 2 ? `${n.slice(0, 2).join(", ")} i ${n.length - 2} więcej` : n.join(", "); };

const iso = (v) => { const t = v ? new Date(v).getTime() : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const zl = (n) => `${Number(n || 0).toFixed(2).replace(".", ",").replace(",00", "")} zł`;
const plDate = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "Europe/Warsaw" });
const hm = (v) => new Date(v).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
const wDay = (v) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(v));
function whenEvent(v) {
  const today = warsawToday(), d = wDay(v), tomorrow = wDay(Date.now() + DAY);
  if (d === today) return `dziś o ${hm(v)}`;
  if (d === tomorrow) return `jutro o ${hm(v)}`;
  return `${new Date(v).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" })}, ${hm(v)}`;
}

// ---- Dane wspólne dla wszystkich (5 min w pamięci instancji) ----
let G: { at: number; v: any } | null = null;
async function globalData(base44) {
  if (G && Date.now() - G.at < 300000) return G.v;
  const sr = base44.asServiceRole.entities;
  const [products, events, codes, stories] = await Promise.all([
    runSql(base44, `SELECT id::text AS id, name, slug, subtitle, promise, COALESCE(status, 'dostępny') AS status, is_free,
        price::float8 AS price, price_regular::float8 AS price_regular, price_start::float8 AS price_start,
        promo_end_date::text AS promo_end_date, to_jsonb(p)->'price_steps' AS price_steps,
        COALESCE((to_jsonb(p)->>'available_at')::timestamptz, created_date::timestamptz) AS since,
        created_date::timestamptz AS created
      FROM public.products p WHERE active = TRUE AND COALESCE(status, 'dostępny') <> 'ukryty'`, true).catch(() => []),
    runSql(base44, `SELECT e.id::text AS id, e.title, e.slug, e.start_datetime,
        COALESCE((to_jsonb(e)->>'created_at')::timestamptz, (to_jsonb(e)->>'created_date')::timestamptz) AS created
      FROM public.events e WHERE e.status = 'Opublikowane' AND e.start_datetime > now() AND e.start_datetime < now() + interval '60 days'
      ORDER BY e.start_datetime ASC LIMIT 40`, true).catch(() => []),
    sr.DiscountCode.filter({ active: true, w_powiadomieniach: true }, "-created_date", 20).catch(() => []),
    sr.RozdrozaStory.filter({ status: "published" }, "-updated_date", 100).catch(() => []),
  ]);
  // Początek bieżącej ceny promocyjnej (z historii cen), żeby „promocja” miała datę.
  const today = warsawToday();
  const promo = (products || []).map((p) => withSteps(p)).filter((p) => p.status === "dostępny" && !p.is_free && p.price_start != null && p.promo_end_date && String(p.promo_end_date).slice(0, 10) >= today);
  const hist = promo.length ? await runSql(base44, `SELECT product_id, day::text AS day, price::float8 AS price FROM public.product_price_daily
      WHERE product_id IN (${promo.map((p) => escStr(p.id)).join(",")}) AND day > (now() AT TIME ZONE 'Europe/Warsaw')::date - 90 ORDER BY day DESC`, true).catch(() => []) : [];
  for (const p of promo) {
    const cur = unitPrice(p);
    let start = null;
    for (const h of hist.filter((h) => h.product_id === p.id)) { if (Math.abs(h.price - cur) < 0.005) start = h.day; else break; }
    p.promo_from = start ? `${start}T08:00:00Z` : iso(p.since);
  }
  const v = { products: products || [], promo, events: events || [], codes, stories };
  G = { at: Date.now(), v };
  return v;
}

// ---- Lista dla osoby ----
async function buildFeed(base44, me) {
  const sr = base44.asServiceRole.entities;
  const email = clientEmail(me);
  const now = Date.now();
  const recent = (v, days = NEW_DAYS) => { const t = v ? new Date(v).getTime() : 0; return t > now - days * DAY && t <= now + 60000; };
  const g = await globalData(base44);
  const out = [];
  const push = (x) => { if (x.at) out.push(x); };

  const [anns, regs, access, msgs, obok, waits, orders, revOrders, myRevs] = await Promise.all([
    myAnnouncements(base44.asServiceRole, base44, me).catch(() => ({ items: [], seen: {} })),
    runSql(base44, `SELECT e.id::text AS id, e.title, e.slug, e.start_datetime, r.status AS reg_status, e.recording_until,
        (e.recording_url IS NOT NULL AND e.recording_until IS NOT NULL AND e.recording_until > now()
          AND e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') < now()) AS rec_open,
        e.start_datetime + (COALESCE(e.duration_minutes,60) * interval '1 minute') AS ends
      FROM public.registrations r JOIN public.events e ON e.id = r.event_id
      WHERE lower(r.email) = ${escStr(email)} AND r.status IN ('Zapisany','Obecny','Lista rezerwowa')
        AND e.status = 'Opublikowane' AND e.start_datetime > now() - interval '30 days'`, true).catch(() => []),
    sr.Access.filter({ user_email: email }, "-created_date", 200).catch(() => []),
    (async () => {
      const s = await libSettings(base44).catch(() => null);
      if (!s || !modeVisible(s.messages_mode, me)) return [];
      return (await messagesData(base44, email, me, false)).items.filter((m) => !m.read_at).slice(0, 5);
    })().catch(() => []),
    (async () => {
      const mine = await sr.ObokUczestnik.filter({ user_email: email }, "-created_date", 50);
      if (!mine.length) return [];
      const ids = [...new Set(mine.map((u) => u.seria_id))];
      const [recs, series] = await Promise.all([
        sr.ObokNagranie.filter({ seria_id: { $in: ids }, status: "opublikowane" }, "-publikacja", 50),
        sr.ObokSeria.filter({ id: { $in: ids } }, "nazwa", 50),
      ]);
      const slug = Object.fromEntries(series.map((s) => [s.id, s.slug]));
      return recs.filter((r) => recent(r.publikacja, 14) && slug[r.seria_id]).map((r) => ({ ...r, seria_slug: slug[r.seria_id] }));
    })().catch(() => []),
    // Moja lista oczekujących i zamówienia z ostatnich 14 dni (płatne).
    runSql(base44, `SELECT DISTINCT product_id::text AS id FROM public.waitlist WHERE lower(email) = ${escStr(email)}`, true).catch(() => []),
    runSql(base44, `SELECT id, status, total::float8 AS total, items, created_date::timestamptz AS created, updated_date::timestamptz AS updated
      FROM public.orders WHERE lower(buyer_email) = ${escStr(email)} AND COALESCE(total, 0) > 0 AND created_date::timestamptz > now() - interval '14 days'
      ORDER BY created_date DESC LIMIT 10`, true).catch(() => []),
    // Opinie: zamówienia opłacone w ostatnich 60 dniach i już wystawione opinie (żeby przypomnienie zniknęło).
    runSql(base44, `SELECT id::text AS id, items, COALESCE(updated_date, created_date)::timestamptz AS paid
      FROM public.orders WHERE lower(buyer_email) = ${escStr(email)} AND status = 'COMPLETED'
        AND COALESCE(updated_date, created_date) > now() - interval '60 days'`, true).catch(() => []),
    runSql(base44, `SELECT order_id, product_id FROM public.product_reviews WHERE lower(email) = ${escStr(email)}`, true).catch(() => []),
  ]);

  // Ogłoszenia od Dawida (zawsze).
  for (const a of anns.items) {
    push({ key: `ann:${a.id}`, kind: "ogloszenie", title: a.tytul, body: a.tresc || "", link: a.przycisk_link || "/konto",
      at: iso(a.od || a.created_date), important: !!a.wazne, ann_id: a.id, ann_seen: !!anns.seen[a.id]?.seen_at });
  }

  const today = warsawToday();
  const owned = new Set(access.filter((x) => !x.revoked).map((x) => String(x.product_id)));
  // Z mojej listy oczekujących: premiera (osobiste, ważne) — zamiast ogólnej „nowości” dla tego produktu.
  const waiting = new Set((waits || []).map((w) => String(w.id)));
  for (const p of g.products) {
    if (!waiting.has(p.id) || owned.has(p.id) || p.status !== "dostępny" || !recent(p.since)) continue;
    push({ key: `wl:${p.id}`, kind: "lista", title: `Już dostępne: ${p.name}`, body: "Ten adres był na liście oczekujących — premiera właśnie się odbyła.",
      link: `/skarbiec/${p.slug}`, at: iso(p.since), important: true });
  }
  // Zamówienia: opłacone (7 dni) i niedokończona płatność (20 min – 48 h, jeśli później nic nie opłacono).
  const paidAfter = (t) => (orders || []).some((o) => o.status === "COMPLETED" && new Date(o.created).getTime() > t);
  for (const o of orders || []) {
    const created = new Date(o.created).getTime();
    const what = names(o.items);
    if (o.status === "COMPLETED" && recent(o.updated || o.created, 7)) {
      push({ key: `order:${o.id}`, kind: "zamowienie", title: `Płatność przyjęta${what ? `: ${what}` : ""}`, body: `${zl(o.total)} · materiały są w zakładce „Moje produkty”.`,
        link: "/konto?tab=produkty", at: iso(o.updated || o.created) });
    } else if (PENDING.includes(o.status) && now - created > 20 * 60000 && now - created < 2 * DAY && !paidAfter(created)) {
      push({ key: `pay:${o.id}`, kind: "platnosc", title: `Płatność niedokończona${what ? `: ${what}` : ""}`, body: "Jeśli to nie było celowe, możesz złożyć zamówienie jeszcze raz w Skarbcu. Gdy PayU potwierdzi wcześniejszą płatność, ta informacja zniknie.",
        link: "/skarbiec", at: new Date(created + 20 * 60000).toISOString(), important: true });
    }
  }
  // Opinie: 14 dni po opłaceniu, jedno na produkt z zamówienia. Znika po wystawieniu opinii i po 60 dniach.
  const reviewed = new Set((myRevs || []).map((r) => `${r.order_id}:${r.product_id}`));
  for (const o of revOrders || []) {
    const paid = new Date(o.paid).getTime();
    if (!Number.isFinite(paid) || paid > now - 14 * DAY) continue;
    for (const it of Array.isArray(o.items) ? o.items : []) {
      const pid = it?.product_id ? String(it.product_id) : "";
      if (!pid || it.gift || reviewed.has(`${o.id}:${pid}`)) continue;
      push({ key: `rev:${o.id}:${pid}`, kind: "opinia",
        title: `Jak Ci się czyta/słucha „${String(it.name || "").slice(0, 60)}”?`,
        body: "Zostaw opinię — kilka zdań. Publikujemy też krytyczne, nie płacimy za opinie.",
        link: "/konto?tab=zakupy", at: new Date(paid + 14 * DAY).toISOString() });
    }
  }
  // Nowe lekcje w moich kursach (dodane po zakupie, 14 dni) — jedno powiadomienie na kurs.
  const courses = access.filter((x) => !x.revoked && ["kurs", "wideo"].includes(x.product_type) && (!x.valid_until || x.valid_until >= today));
  if (courses.length) {
    const lessons = await sr.CourseLesson.filter({ product_id: { $in: courses.map((c) => String(c.product_id)) }, published: true }, "-created_date", 100).catch(() => []);
    for (const c of courses) {
      const fresh = lessons.filter((l) => String(l.product_id) === String(c.product_id) && recent(l.created_date, 14) && new Date(l.created_date) > new Date(c.created_date));
      if (!fresh.length) continue;
      push({ key: `lesson:${c.product_id}:${fresh[0].id}`, kind: "lekcja", title: fresh.length === 1 ? `Nowa lekcja w „${c.product_name || "kursie"}”: ${fresh[0].title}` : `${fresh.length} ${[2, 3, 4].includes(fresh.length % 10) && ![12, 13, 14].includes(fresh.length % 100) ? "nowe lekcje" : "nowych lekcji"} w „${c.product_name || "kursie"}”`,
        body: "", link: `/konto/kurs/${c.id}`, at: iso(fresh[0].created_date) });
    }
  }
  // Nowości w Skarbcu i zapowiedzi.
  for (const p of g.products) {
    if (owned.has(p.id) || waiting.has(p.id) && p.status === "dostępny") continue;
    if (p.status === "dostępny" && recent(p.since)) {
      push({ key: `prod:${p.id}`, kind: "produkt", title: `${p.is_free ? "Nowy bezpłatny materiał" : "Nowe w Skarbcu"}: ${p.name}`,
        body: p.promise || p.subtitle || "", link: `/skarbiec/${p.slug}`, at: iso(p.since) });
    } else if (p.status === "wkrótce" && recent(p.created)) {
      push({ key: `soon:${p.id}`, kind: "wkrotce", title: `Wkrótce: ${p.name}`,
        body: waiting.has(p.id) ? "Ten adres jest już na liście oczekujących — dam znać w dniu premiery." : "Zapisz się na listę oczekujących — dam znać w dniu premiery.", link: `/skarbiec/${p.slug}`, at: iso(p.created) });
    }
  }
  // Promocje i przedsprzedaże (+ jedno przypomnienie na 2 dni przed końcem ceny).
  for (const p of g.promo) {
    if (owned.has(p.id)) continue;
    const price = unitPrice(p), end = String(p.promo_end_date).slice(0, 10);
    const next = p.next_price ? `, potem ${zl(p.next_price.cena)}` : p.price_regular ? `, potem ${zl(p.price_regular)}` : "";
    push({ key: `promo:${p.id}:${end}:${price}`, kind: "promocja", title: `${p.next_price && p.next_price.cena > price ? "Przedsprzedaż" : "Promocja"}: ${p.name} za ${zl(price)}`,
      body: `Ta cena obowiązuje do ${plDate(end)}${next}.`, link: `/skarbiec/${p.slug}`, at: p.promo_from });
    const endsAt = new Date(`${end}T00:00:00Z`).getTime() - DAY; // ok. 2 dni przed końcem (koniec dnia „end”)
    if (endsAt <= now && end >= today) {
      push({ key: `promo-end:${p.id}:${end}:${price}`, kind: "promocja", title: `Ostatnie dni ceny ${zl(price)}: ${p.name}`,
        body: `Do ${plDate(end)} włącznie${next}.`, link: `/skarbiec/${p.slug}`, at: new Date(endsAt).toISOString(), important: true });
    }
  }
  // Kody rabatowe, które Dawid oznaczył do pokazania.
  for (const c of g.codes) {
    if (c.valid_until && c.valid_until < today) continue;
    if (c.max_uses && (c.uses || 0) >= c.max_uses) continue;
    const val = c.kind === "kwota" ? `−${zl(c.value)}` : `−${c.value}%`;
    push({ key: `code:${c.id}`, kind: "kod", title: `Kod rabatowy ${c.code}: ${val}`,
      body: [c.opis ? String(c.opis).replace(/[.!]?\s*$/, ".") : "", c.product_ids?.length ? "Na wybrane produkty." : "Na cały Skarbiec.", c.valid_until ? `Ważny do ${plDate(c.valid_until)}.` : ""].filter(Boolean).join(" "),
      link: "/skarbiec", at: iso(c.created_date), code: c.code });
  }
  // Moje spotkania: przypomnienie w ostatniej dobie, nagranie do obejrzenia.
  const registered = new Set(regs.map((r) => r.id));
  for (const r of regs) {
    const start = new Date(r.start_datetime).getTime();
    if (start > now && start - now <= DAY && r.reg_status !== "Lista rezerwowa") {
      push({ key: `ev-soon:${r.id}`, kind: "moje_spotkanie", title: `${whenEvent(r.start_datetime).replace(/^./, (c) => c.toUpperCase())}: ${r.title}`,
        body: "Link do dołączenia jest w Twoim koncie (zakładka Spotkania) i w mailu.", link: "/konto?tab=spotkania", at: new Date(start - DAY).toISOString(), important: true });
    }
    if (r.rec_open) {
      push({ key: `rec:${r.id}:${r.recording_until}`, kind: "nagranie", title: `Nagranie czeka: ${r.title}`,
        body: `Dostępne do ${plDate(wDay(r.recording_until))}, ${hm(r.recording_until)}.`, link: "/konto?tab=spotkania", at: iso(r.ends) });
    }
  }
  // Nowe spotkania (te, na które jeszcze się nie zapisano).
  for (const e of g.events) {
    if (registered.has(e.id) || !recent(e.created)) continue;
    push({ key: `ev-new:${e.id}`, kind: "spotkanie", title: `Nowe spotkanie: ${e.title}`, body: whenEvent(e.start_datetime).replace(/^./, (c) => c.toUpperCase()) + ".",
      link: `/spotkania/${e.slug}`, at: iso(e.created) });
  }
  // Dostęp kończy się w ciągu 14 dni.
  const in14 = new Date(now + 14 * DAY).toISOString().slice(0, 10);
  for (const a of access) {
    if (a.revoked || !a.valid_until || a.valid_until < today || a.valid_until > in14) continue;
    push({ key: `access:${a.id}:${a.valid_until}`, kind: "dostep", title: `Dostęp do „${a.product_name || "materiału"}” kończy się ${plDate(a.valid_until)}`,
      body: "Zajrzyj, póki możesz — dostęp możesz też przedłużyć w Skarbcu.", link: "/konto?tab=produkty",
      at: new Date(new Date(`${a.valid_until}T00:00:00Z`).getTime() - 14 * DAY).toISOString(), important: a.valid_until <= new Date(now + 3 * DAY).toISOString().slice(0, 10) });
  }
  // Wiadomości od Dawida (nieprzeczytane).
  for (const m of msgs) {
    push({ key: `msg:${m.id}`, kind: "wiadomosc", title: m.title ? `Wiadomość: ${m.title}` : "Nowa wiadomość od Dawida",
      body: "", link: "/konto?tab=wiadomosci", at: iso(m.sent_at), important: true });
  }
  // Nowe historie w ROZDROŻACH i nagrania Obok.
  for (const s of g.stories) {
    const from = s.visible_from || s.published_at;
    if (!recent(from, 14)) continue;
    push({ key: `story:${s.id}`, kind: "historia", title: `Nowa historia w ROZDROŻACH: ${s.title}`, body: "", link: `/konto/rozdroza/${s.slug}`, at: iso(from) });
  }
  for (const r of obok) {
    push({ key: `obok:${r.id}`, kind: "obok", title: `Nowe nagranie w Obok: ${r.tytul}`, body: "", link: `/obok/${r.seria_slug}/${r.numer}`, at: iso(r.publikacja) });
  }
  return out.filter((x) => x.at && new Date(x.at).getTime() <= now + 60000);
}

async function getState(sr, me) {
  const rows = await sr.NotificationState.filter({ user_id: me.id }, "-created_date", 2);
  return rows[0] || null;
}

const cacheFeed = new Map<string, { at: number; v: any[] }>();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole.entities;
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ items: [], unread: 0, prefs: DEFAULT_PREFS });
    const body = await req.json().catch(() => ({}));
    const a = body.action || "feed";
    let st = await getState(sr, me);
    const save = async (patch) => {
      st = st ? await sr.NotificationState.update(st.id, patch) : await sr.NotificationState.create({ user_id: me.id, ...patch });
      return st;
    };
    const cap = (arr) => arr.slice(-200);

    if (a === "prefs") {
      const p = body.prefs || {};
      const prefs = Object.fromEntries(Object.keys(DEFAULT_PREFS).map((k) => [k, p[k] !== false]));
      await save({ prefs });
      cacheFeed.delete(me.id);
      return Response.json({ ok: true, prefs });
    }

    const hit = cacheFeed.get(me.id);
    const all = hit && Date.now() - hit.at < 30000 ? hit.v : await buildFeed(base44, me);
    if (!hit || hit.v !== all) cacheFeed.set(me.id, { at: Date.now(), v: all });
    if (cacheFeed.size > 2000) cacheFeed.clear();

    if (a === "read" || a === "hide") {
      const key = String(body.key || "").slice(0, 200);
      const item = all.find((x) => x.key === key);
      if (!item) return Response.json({ ok: true });
      const read = new Set(st?.read || []); read.add(key);
      const patch: Record<string, unknown> = { read: cap([...read]) };
      if (a === "hide") patch.hidden = cap([...new Set([...(st?.hidden || []), key])]);
      await save(patch);
      if (item.ann_id) await markAnnSeen(sr, me, [item.ann_id]);
      return Response.json({ ok: true });
    }

    if (a === "read_all") {
      await save({ seen_at: new Date().toISOString(), read: [] });
      const ids = all.filter((x) => x.ann_id && !x.ann_seen).map((x) => x.ann_id);
      if (ids.length) await markAnnSeen(sr, me, ids);
      cacheFeed.delete(me.id);
      return Response.json({ ok: true });
    }

    // feed
    const prefs = { ...DEFAULT_PREFS, ...(st?.prefs || {}) };
    const seenAt = st?.seen_at ? new Date(st.seen_at).getTime() : 0;
    const read = new Set(st?.read || []), hidden = new Set(st?.hidden || []);
    const items = all
      .filter((x) => !hidden.has(x.key))
      .filter((x) => { const c = CAT[x.kind]; return c === "zawsze" || c === "moje" || prefs[c] !== false; })
      .map((x) => ({ key: x.key, kind: x.kind, title: x.title, body: x.body, link: x.link, at: x.at, important: !!x.important, code: x.code || null,
        unread: !read.has(x.key) && new Date(x.at).getTime() > seenAt && !(x.ann_id && x.ann_seen) }))
      .sort((p, q) => (q.unread ? 1 : 0) - (p.unread ? 1 : 0) || (q.important ? 1 : 0) - (p.important ? 1 : 0) || q.at.localeCompare(p.at))
      .slice(0, 30);
    return Response.json({ items, unread: items.filter((x) => x.unread).length, prefs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function markAnnSeen(sr, me, ids) {
  const S = sr.AnnouncementSeen;
  const prev = await S.filter({ user_id: me.id, ann_id: { $in: ids } }, "-created_date", 50).catch(() => []);
  const now = new Date().toISOString();
  for (const id of ids) {
    const p = prev.find((s) => s.ann_id === id);
    if (p?.seen_at) continue;
    await (p ? S.update(p.id, { seen_at: now }) : S.create({ ann_id: id, user_id: me.id, seen_at: now })).catch(() => {});
  }
}