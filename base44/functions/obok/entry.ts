import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { unlockTimes, canJoin } from "../../shared/obok.ts";

// Strefa Obok: dostęp, harmonogram i pliki sprawdzane na serwerze.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;
    const action = String(body.action || "");

    // Wyłączenie powiadomień linkiem z e-maila — bez logowania.
    if (action === "unsub") {
      const t = String(body.token || "");
      if (!/^[a-f0-9-]{20,}$/.test(t)) return Response.json({ error: "Nieprawidłowy link" }, { status: 400 });
      const [u] = await sr.ObokUczestnik.filter({ token: t }, "-created_date", 1);
      if (!u) return Response.json({ error: "Nieprawidłowy link" }, { status: 404 });
      await sr.ObokUczestnik.update(u.id, { powiadomienia: false });
      return Response.json({ ok: true });
    }
    // Publiczne minimum o serii (strona zapisu) — bez nagrań.
    if (action === "public") {
      const [s] = await sr.ObokSeria.filter({ slug: String(body.slug || ""), status: "aktywna" }, "-created_date", 1);
      if (!s) return Response.json({ error: "Nie ma takiej serii" }, { status: 404 });
      return Response.json({ nazwa: s.nazwa, opis_krotki: s.opis_krotki || "", edycja_start: s.edycja_start || null });
    }

    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: "Zaloguj się" }, { status: 401 });
    if (me.role === "zablokowane") return Response.json({ error: "To konto jest zablokowane." }, { status: 403 }); // stare konto po zmianie adresu
    const email = String(me.email).toLowerCase();
    const admin = me.role === "admin";
    const now = admin && body.sim ? Date.parse(body.sim) : Date.now();

    const mine = await sr.ObokUczestnik.filter({ user_email: email }, "-created_date", 200);
    const memberOf = new Map(mine.map((u) => [u.seria_id, u]));
    const hasAccess = async (s) => {
      if (admin) return true;
      if (s.status !== "aktywna") return false;
      if (s.dostep === "zalogowani") return true;
      if (memberOf.has(s.id)) return true;
      if (s.dostep === "produkt" && s.produkt_id) {
        const a = await sr.Access.filter({ user_email: email, product_id: s.produkt_id }, "-created_date", 1);
        return a.length > 0;
      }
      return false;
    };
    const joinedMs = (s) => { const u = memberOf.get(s.id); return u ? Date.parse(u.joined_at || u.created_date) : (s.dostep === "zalogowani" ? Date.parse(me.created_date) : null); };
    const load = async (s) => {
      const recs = await sr.ObokNagranie.filter({ seria_id: s.id }, "numer", 200);
      const times = unlockTimes(s, recs, joinedMs(s));
      const heard = await sr.ObokOdsluch.filter({ user_email: email, seria_id: s.id }, "-updated_date", 300);
      const hm = new Map(heard.map((h) => [h.nagranie_id, h]));
      return { recs, times, hm, plan: unlockTimes(s, recs, joinedMs(s), true) };
    };
    const bySlug = async (slug) => (await sr.ObokSeria.filter({ slug: String(slug || "") }, "-created_date", 1))[0];

    if (action === "home") {
      const all = await sr.ObokSeria.filter(admin ? {} : { status: "aktywna" }, "kolejnosc", 100);
      const tiles = [];
      for (const s of all) {
        if (!(await hasAccess(s))) continue;
        const { recs, times, hm } = await load(s);
        const open = recs.filter((r) => times.get(r.id) != null && (times.get(r.id) as number) <= now);
        const next = recs.filter((r) => times.get(r.id) != null && (times.get(r.id) as number) > now).sort((a, b) => (times.get(a.id) as number) - (times.get(b.id) as number))[0];
        tiles.push({ id: s.id, nazwa: s.nazwa, slug: s.slug, opis_krotki: s.opis_krotki || "", okladka: s.okladka || "", typ: s.typ,
          total: recs.length, open: open.length, heard: open.filter((r) => hm.get(r.id)?.ukonczone).length,
          next: next ? { tytul: next.tytul, at: new Date(times.get(next.id) as number).toISOString() } : null,
          powiadomienia: !!memberOf.get(s.id)?.powiadomienia, member: memberOf.has(s.id) });
      }
      return Response.json({ tiles, imie: me.full_name || "" });
    }

    if (action === "join") {
      const s = await bySlug(body.slug);
      if (!s || s.status !== "aktywna") return Response.json({ error: "Nie ma takiej serii" }, { status: 404 });
      const exist = memberOf.get(s.id);
      if (!exist) {
        const n = (await sr.ObokNagranie.filter({ seria_id: s.id }, "numer", 200)).length;
        if (!canJoin(s, now, n)) return Response.json({ error: "Ta edycja jest zamknięta. Daj znać, a napiszę o kolejnej." }, { status: 409 });
        await sr.ObokUczestnik.create({ seria_id: s.id, user_email: email, imie: me.full_name || "", joined_at: new Date().toISOString(),
          powiadomienia: !!body.powiadomienia, zrodlo: String(body.zrodlo || "").slice(0, 80), token: crypto.randomUUID() + crypto.randomUUID().slice(0, 8), wyslane: [] });
      }
      return Response.json({ ok: true, edycja_start: s.edycja_start || null });
    }

    if (action === "notify" || action === "leave") {
      const u = mine.find((x) => x.seria_id === String(body.seria_id || ""));
      if (!u) return Response.json({ error: "Nie należysz do tej serii" }, { status: 404 });
      if (action === "leave") {
        const h = await sr.ObokOdsluch.filter({ user_email: email, seria_id: u.seria_id }, "-created_date", 500);
        for (const x of h) await sr.ObokOdsluch.delete(x.id);
        await sr.ObokUczestnik.delete(u.id);
      } else await sr.ObokUczestnik.update(u.id, { powiadomienia: !!body.on });
      return Response.json({ ok: true });
    }

    const s = await bySlug(body.slug);
    if (!s || !(await hasAccess(s))) return Response.json({ error: "Brak dostępu", seria: s && s.status === "aktywna" ? { nazwa: s.nazwa, landing: s.landing_slug || "" } : null }, { status: 403 });
    const { recs, times, hm, plan } = await load(s);
    const isOpen = (r) => times.get(r.id) != null && (times.get(r.id) as number) <= now;

    if (action === "seria") {
      return Response.json({
        seria: { id: s.id, nazwa: s.nazwa, slug: s.slug, opis: s.opis || "", okladka: s.okladka || "", typ: s.typ },
        nagrania: recs.map((r) => ({ numer: r.numer, tytul: r.tytul, dlugosc_s: r.dlugosc_s || 0, open: isOpen(r),
          at: s.typ !== "zbior" ? new Date(plan.get(r.id) as number).toISOString() : null,
          ukonczone: !!hm.get(r.id)?.ukonczone, publikacja: r.publikacja || null })),
      });
    }

    const r = recs.find((x) => x.numer === Number(body.numer));
    if (!r || !isOpen(r)) return Response.json({ error: "To nagranie jeszcze się nie otworzyło" }, { status: 403 });

    if (action === "nagranie") {
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: r.plik_uri, expires_in: 10800 });
      return Response.json({
        seria: { nazwa: s.nazwa, slug: s.slug, okladka: s.okladka || "" },
        n: { id: r.id, numer: r.numer, tytul: r.tytul, opis: r.opis || "", format: r.format, obraz: r.obraz || "", dlugosc_s: r.dlugosc_s || 0,
          pytanie: r.pytanie || "", transkrypcja: r.transkrypcja || "", material_nazwa: r.material_nazwa || "", material_url: r.material_url || "",
          ostrzezenie: !!r.ostrzezenie, src: signed_url, pozycja_s: hm.get(r.id)?.pozycja_s || 0 },
      });
    }

    if (action === "progress") {
      const pos = Math.max(0, Number(body.pozycja) || 0);
      const done = !!body.ukonczone || (r.dlugosc_s > 0 && pos >= r.dlugosc_s * 0.9);
      const h = hm.get(r.id);
      if (h) await sr.ObokOdsluch.update(h.id, { pozycja_s: pos, ukonczone: h.ukonczone || done });
      else await sr.ObokOdsluch.create({ nagranie_id: r.id, seria_id: s.id, user_email: email, pozycja_s: pos, ukonczone: done });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}