import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr } from "../_shared/supabase.ts";
import { annStatus, myAnnouncements } from "../_shared/announce.ts";

// Ogłoszenia na koncie — wyłącznie na stronie (bez e-maili).
// Klient: "mine" (aktywne dla mnie + liczba nieprzeczytanych), "event" (seen/view/click/dismiss).
// Administrator: list, options, save, publish, end, duplicate, delete.

const KINDS = ["ogloszenie", "zaproszenie", "przypomnienie"];
const AUD = ["wszyscy", "produkt", "obok", "spotkanie"];
const str = (v, max) => String(v ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max);
const dt = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };

export { annStatus };

function clean(b) {
  const link = str(b.przycisk_link, 500);
  if (link && !/^(\/|https:\/\/)/.test(link)) throw new Error("Link przycisku: adres na stronie (/...) albo https://...");
  const odbiorcy = AUD.includes(b.odbiorcy) ? b.odbiorcy : "wszyscy";
  if (odbiorcy !== "wszyscy" && !b.cel_id) throw new Error("Wybierz, do kogo trafia ogłoszenie.");
  const od = dt(b.od), d = dt(b.do);
  if (od && d && d <= od) throw new Error("Koniec musi być po początku.");
  return {
    rodzaj: KINDS.includes(b.rodzaj) ? b.rodzaj : "ogloszenie",
    tytul: str(b.tytul, 60) || (() => { throw new Error("Wpisz tytuł."); })(),
    tresc: String(b.tresc ?? "").trim().slice(0, 200),
    przycisk_napis: str(b.przycisk_napis, 30), przycisk_link: link,
    odbiorcy, cel_id: odbiorcy === "wszyscy" ? "" : String(b.cel_id), cel_nazwa: odbiorcy === "wszyscy" ? "" : str(b.cel_nazwa, 200),
    od, do: d, zamykalne: b.zamykalne !== false, wazne: b.wazne === true, test: b.test === true,
  };
}

async function recipients(sr, base44, a) {
  if (a.odbiorcy === "wszyscy") return (await sr.entities.User.list("-created_date", 10000)).filter((u) => u.role !== "zablokowane").length;
  if (a.odbiorcy === "produkt") return sr.entities.Access.count({ product_id: a.cel_id });
  if (a.odbiorcy === "obok") return sr.entities.ObokUczestnik.count({ seria_id: a.cel_id });
  const r = await runSql(base44, `SELECT COUNT(DISTINCT lower(email))::int AS n FROM public.registrations WHERE event_id = ${escStr(a.cel_id)}
    AND status IN ('Zapisany','Obecny','Lista rezerwowa')`, true).catch(() => [{ n: 0 }]);
  return r[0]?.n || 0;
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const A = sr.entities.Announcement, S = sr.entities.AnnouncementSeen;

    if (body.action === "mine") {
      if (me.role === "zablokowane") return Response.json({ items: [], unread: 0 });
      const { items: mineOpen, seen: by } = await myAnnouncements(sr, base44, me);
      const items = mineOpen
        .sort((x, y) => (y.wazne ? 1 : 0) - (x.wazne ? 1 : 0) || String(y.od || y.created_date).localeCompare(String(x.od || x.created_date)))
        .map((a) => ({ id: a.id, rodzaj: a.rodzaj, tytul: a.tytul, tresc: a.tresc, przycisk_napis: a.przycisk_napis, przycisk_link: a.przycisk_link, zamykalne: a.zamykalne !== false, wazne: !!a.wazne }));
      return Response.json({ items, unread: items.filter((a) => !by[a.id]?.seen_at).length });
    }

    if (body.action === "event") {
      const type = { seen: "seen_at", view: "viewed_at", click: "clicked_at", dismiss: "dismissed_at" }[body.type];
      const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map(String).slice(0, 50);
      if (!type || !ids.length) return Response.json({ error: "Zła akcja" }, { status: 400 });
      const ann = await A.filter({ id: { $in: ids }, opublikowane: true }, "-created_date", 50);
      const ok = new Set(ann.map((a) => a.id));
      const prev = await S.filter({ user_id: me.id, ann_id: { $in: [...ok] } }, "-created_date", 50);
      const now = new Date().toISOString();
      for (const id of ok) {
        if (type === "dismiss" && ann.find((a) => a.id === id)?.zamykalne === false) continue;
        const p = prev.find((s) => s.ann_id === id);
        const patch = { [type]: p?.[type] || now, seen_at: p?.seen_at || now };
        if (type !== "seen") patch.viewed_at = p?.viewed_at || now;
        p ? await S.update(p.id, patch) : await S.create({ ann_id: id, user_id: me.id, ...patch });
      }
      return Response.json({ ok: true });
    }

    // --- Dalej tylko administrator (rola Techniczna nie ma dostępu) ---
    if (me.role !== "admin") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    const log = (a, akcja) => sr.entities.AnnouncementLog.create({ ann_id: a.id, tytul: a.tytul, akcja, kto: me.email });

    if (body.action === "list") {
      const rows = await A.list("-created_date", 200);
      const liveIds = rows.filter((a) => annStatus(a) !== "Szkic").map((a) => a.id);
      // Liczniki zbiorczo: trzy zapytania dla całej listy zamiast czterech na każde ogłoszenie.
      // Wcześniej panel przy 200 ogłoszeniach wysyłał setki zapytań, w tym wielokrotnie listę wszystkich kont.
      const grouped = async (field) => {
        if (!liveIds.length) return new Map();
        const r = await S.aggregate({ query: { ann_id: { $in: liveIds }, [field]: { $gt: "2000" } }, groupBy: "ann_id", limit: 1000 });
        return new Map((r.rows || []).map((x) => [String(x.ann_id), x.count]));
      };
      const [wysw, klik, zamk] = await Promise.all([grouped("viewed_at"), grouped("clicked_at"), grouped("dismissed_at")]);
      // Liczba odbiorców jednej grupy liczona raz (dawniej raz na ogłoszenie, także dla „wszyscy”).
      const recCache = new Map();
      const recCount = (a) => {
        const key = `${a.odbiorcy}:${a.cel_id || ""}`;
        if (!recCache.has(key)) recCache.set(key, recipients(sr, base44, a));
        return recCache.get(key);
      };
      const items = [];
      for (const a of rows) {
        const st = annStatus(a);
        const stats = st === "Szkic" ? null : {
          odbiorcy: await recCount(a),
          wyswietlenia: wysw.get(a.id) || 0,
          klikniecia: klik.get(a.id) || 0,
          zamkniecia: zamk.get(a.id) || 0,
        };
        items.push({ ...a, status: st, stats });
      }
      const logs = await sr.entities.AnnouncementLog.list("-created_date", 50);
      return Response.json({ items, logs });
    }

    if (body.action === "options") {
      const [products, series, events] = await Promise.all([
        sr.entities.Product.list("name", 500),
        sr.entities.ObokSeria.list("nazwa", 200),
        runSql(base44, `SELECT id, title, start_datetime FROM public.events WHERE status IN ('Opublikowane','Szkic') ORDER BY start_datetime DESC NULLS LAST LIMIT 100`, true).catch(() => []),
      ]);
      return Response.json({
        produkt: products.map((p) => ({ id: p.id, nazwa: p.name })),
        obok: series.map((s) => ({ id: s.id, nazwa: s.nazwa })),
        spotkanie: events.map((e) => ({ id: e.id, nazwa: `${e.title}${e.start_datetime ? " · " + new Date(e.start_datetime).toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" }) : ""}` })),
      });
    }

    if (body.action === "save" || body.action === "publish") {
      const data = clean(body.item || {});
      if (body.action === "publish") { data.opublikowane = true; data.zakonczono_at = null; }
      const id = body.item?.id;
      const a = id ? await A.update(id, data) : await A.create(data);
      await log(a, body.action === "publish" ? "opublikowano" : id ? "zmieniono" : "utworzono");
      return Response.json({ ok: true, item: a });
    }

    const a = await A.get(String(body.id || ""));
    if (body.action === "end") { await A.update(a.id, { zakonczono_at: new Date().toISOString() }); await log(a, "zakonczono"); return Response.json({ ok: true }); }
    if (body.action === "duplicate") {
      const { id, created_date, updated_date, created_by_id, created_by, zakonczono_at, ...rest } = a;
      const c = await A.create({ ...rest, tytul: str(`${a.tytul} (kopia)`, 60), opublikowane: false, zakonczono_at: null });
      await log(c, "zduplikowano");
      return Response.json({ ok: true, item: c });
    }
    if (body.action === "delete") {
      await S.deleteMany({ ann_id: a.id });
      await A.delete(a.id);
      await log(a, "usunieto");
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
