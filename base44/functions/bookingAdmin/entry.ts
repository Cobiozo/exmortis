import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, rpc, esc, escStr, requireAdmin, emailField, textField } from "../../shared/supabase.ts";
import { loadKeys, getMode, safeErr, KEYS_MSG } from "../../shared/booking.ts";
import { decryptHealth } from "../../shared/bookingCrypto.ts";
import { SCHEMA_SQL, SEED_SQL } from "../../shared/bookingSchema.ts";

// Panel rezerwacji 1:1 — wyłącznie administrator. Jedyne miejsce odszyfrowania odpowiedzi o zdrowiu.
const int = (v, min, max, def = null) => { const n = Math.round(Number(v)); return Number.isFinite(n) && v !== "" && v !== null ? Math.min(max, Math.max(min, n)) : def; };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const iso = (v) => { const d = new Date(v); if (isNaN(d.getTime())) throw new Error("Niepoprawna data"); return d.toISOString(); };
const log = (base44, actor, action, type, id, summary) => runSql(base44,
  `INSERT INTO public.bk_log (actor, action, object_type, object_id, summary) VALUES (${escStr(actor)}, ${escStr(action)}, ${esc(type)}, ${esc(id)}, ${esc(summary)})`);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const a = body.action;

    if (a === "migrate") {
      await runSql(base44, SCHEMA_SQL);
      await runSql(base44, SEED_SQL);
      return Response.json({ ok: true });
    }

    if (a === "status") {
      const keys = await loadKeys(body.simulate_missing_keys === true);
      return Response.json({ keys_ok: keys.ok, keys: keys.info, mode: await getMode(base44, true) });
    }

    if (a === "get") {
      const [s, types, hours, blocks, hol] = await Promise.all([
        runSql(base44, `SELECT mode, min_notice_h, daily_limit, weekly_limit FROM public.bk_settings WHERE id = 1`, true),
        runSql(base44, `SELECT id, slug, name, description, duration_min, buffer_before, buffer_after, step_min, horizon_days, access, zoom_link, questions, change_window_h, monthly_limit, active FROM public.bk_types ORDER BY sort, name`, true),
        runSql(base44, `SELECT id, type_id, weekday, to_char(start_local,'HH24:MI') AS "from", to_char(end_local,'HH24:MI') AS "to" FROM public.bk_hours ORDER BY weekday, start_local`, true),
        runSql(base44, `SELECT id, kind, starts_at, ends_at, rep_weekday, to_char(rep_from,'HH24:MI') AS rep_from, to_char(rep_to,'HH24:MI') AS rep_to, note FROM public.bk_blocks WHERE NOT disabled AND ends_at > now() ORDER BY starts_at LIMIT 200`, true),
        runSql(base44, `SELECT d, name, blocked FROM public.bk_holidays WHERE d >= date_trunc('year', now())::date ORDER BY d`, true),
      ]);
      return Response.json({ settings: s[0], types: types.map((t) => ({ ...t, hours: hours.filter((h) => h.type_id === t.id) })), blocks, holidays: hol });
    }

    if (a === "save_settings") {
      const mode = ["off", "admin", "on"].includes(body.mode) ? body.mode : "off";
      const daily = int(body.daily_limit, 1, 20, 3), weekly = int(body.weekly_limit, 1, 100, null);
      await runSql(base44, `UPDATE public.bk_settings SET mode = ${escStr(mode)}, daily_limit = ${daily}, weekly_limit = ${esc(weekly)}, updated_at = now() WHERE id = 1`);
      await log(base44, me.email, "ustawienia", "settings", "1", `tryb=${mode} dzien=${daily} tydzien=${weekly ?? "-"}`);
      await getMode(base44, true);
      return Response.json({ ok: true });
    }

    if (a === "save_type") {
      const t = body.type || {};
      const name = textField(t, "name", { max: 120 });
      const access = ["PUBLICZNY", "PO_ZAKUPIE", "PAKIET"].includes(t.access) ? t.access : "PAKIET";
      const zoom = t.zoom_link ? String(t.zoom_link).trim() : null;
      if (zoom && !/^https:\/\/\S+$/.test(zoom)) throw new Error("Link Zoom musi zaczynać się od https://");
      const qs = Array.isArray(t.questions) ? t.questions.slice(0, 10).map((q, i) => ({
        id: /^[a-z0-9]{1,10}$/.test(q.id) ? q.id : `q${i + 1}`, label: String(q.label || "").slice(0, 300), required: !!q.required, health: !!q.health,
      })).filter((q) => q.label) : [];
      const cols = {
        name: escStr(name), description: esc(t.description ? String(t.description).slice(0, 2000) : null),
        duration_min: int(t.duration_min, 10, 480, 60), buffer_before: int(t.buffer_before, 0, 240, 0), buffer_after: int(t.buffer_after, 0, 240, 0),
        step_min: int(t.step_min, 5, 240, 30), horizon_days: int(t.horizon_days, 1, 365, 60), access: escStr(access), zoom_link: esc(zoom),
        questions: `${escStr(JSON.stringify(qs))}::jsonb`, change_window_h: int(t.change_window_h, 0, 720, 24),
        monthly_limit: esc(int(t.monthly_limit, 1, 100, null)), active: t.active === true ? "TRUE" : "FALSE",
      };
      let id = t.id;
      if (id) {
        await runSql(base44, `UPDATE public.bk_types SET ${Object.entries(cols).map(([k, v]) => `${k} = ${v}`).join(", ")} WHERE id = ${escStr(id)}`);
      } else {
        const slug = String(t.slug || "").toLowerCase();
        if (!/^[a-z0-9-]{2,60}$/.test(slug)) throw new Error("Adres: małe litery, cyfry i myślniki");
        id = (await runSql(base44, `INSERT INTO public.bk_types (slug, ${Object.keys(cols).join(", ")}) VALUES (${escStr(slug)}, ${Object.values(cols).join(", ")}) RETURNING id`))[0].id;
      }
      await log(base44, me.email, "rodzaj", "type", id, `${name} aktywny=${t.active === true}`);
      return Response.json({ ok: true, id });
    }

    if (a === "save_hours") {
      const typeId = textField(body, "type_id", { max: 40 });
      const rows = (Array.isArray(body.hours) ? body.hours : []).slice(0, 50).map((h) => {
        const w = int(h.weekday, 1, 7);
        if (!w || !TIME.test(h.from) || !TIME.test(h.to) || h.to <= h.from) throw new Error("Godziny: koniec musi być po początku");
        return `(${escStr(typeId)}::uuid, ${w}, ${escStr(h.from)}::time, ${escStr(h.to)}::time)`;
      });
      await runSql(base44, `WITH d AS (DELETE FROM public.bk_hours WHERE type_id = ${escStr(typeId)}::uuid)
        ${rows.length ? `INSERT INTO public.bk_hours (type_id, weekday, start_local, end_local) VALUES ${rows.join(", ")}` : "SELECT 1"}`);
      await log(base44, me.email, "godziny", "type", typeId, `${rows.length} przedzialow`);
      return Response.json({ ok: true });
    }

    if (a === "save_block") {
      const b = body.block || {};
      const kind = ["jednorazowa", "calodniowa", "powtarzalna"].includes(b.kind) ? b.kind : "jednorazowa";
      const st = iso(b.starts_at), en = iso(b.ends_at);
      if (en <= st) throw new Error("Koniec musi być po początku");
      let rep = "NULL, NULL, NULL";
      if (kind === "powtarzalna") {
        const w = int(b.rep_weekday, 1, 7);
        if (!w || !TIME.test(b.rep_from) || !TIME.test(b.rep_to) || b.rep_to <= b.rep_from) throw new Error("Podaj dzień tygodnia i godziny");
        rep = `${w}, ${escStr(b.rep_from)}::time, ${escStr(b.rep_to)}::time`;
      }
      const id = (await runSql(base44, `INSERT INTO public.bk_blocks (kind, starts_at, ends_at, rep_weekday, rep_from, rep_to, note, created_by)
        VALUES (${escStr(kind)}, ${escStr(st)}, ${escStr(en)}, ${rep}, ${esc(b.note ? String(b.note).slice(0, 500) : null)}, ${escStr(me.email)}) RETURNING id`))[0].id;
      // Rezerwacje, które wypadają w blokadzie, zostają — panel pokazuje listę kolizji.
      const coll = await runSql(base44, `SELECT k.id, t.name AS type, k.starts_at, k.first_name FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
        JOIN public.bk_blocks x ON x.id = ${escStr(id)}::uuid
        WHERE k.status = 'POTWIERDZONA' AND k.busy && tstzrange(x.starts_at, x.ends_at, '[)')
          AND (x.kind <> 'powtarzalna' OR (extract(isodow FROM (k.starts_at AT TIME ZONE 'Europe/Warsaw'))::int = x.rep_weekday
            AND k.busy && tstzrange(((k.starts_at AT TIME ZONE 'Europe/Warsaw')::date + x.rep_from) AT TIME ZONE 'Europe/Warsaw',
              ((k.starts_at AT TIME ZONE 'Europe/Warsaw')::date + x.rep_to) AT TIME ZONE 'Europe/Warsaw', '[)')))
        ORDER BY k.starts_at`, true);
      await log(base44, me.email, "blokada", "block", id, `${kind} ${st}–${en}`);
      return Response.json({ ok: true, id, collisions: coll });
    }

    if (a === "delete_block") {
      const id = textField(body, "id", { max: 40 });
      await runSql(base44, `UPDATE public.bk_blocks SET disabled = TRUE WHERE id = ${escStr(id)}::uuid`);
      await log(base44, me.email, "blokada_usunieta", "block", id, null);
      return Response.json({ ok: true });
    }

    if (a === "toggle_holiday") {
      const d = textField(body, "d", { max: 10 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Niepoprawna data");
      await runSql(base44, `UPDATE public.bk_holidays SET blocked = ${body.blocked === true ? "TRUE" : "FALSE"} WHERE d = ${escStr(d)}::date`);
      await log(base44, me.email, body.blocked === true ? "swieto_zablokowane" : "swieto_odblokowane", "holiday", d, null);
      return Response.json({ ok: true });
    }

    if (a === "bookings") {
      const rows = await runSql(base44, `SELECT k.id, t.name AS type, k.starts_at, k.ends_at, k.first_name, k.email, k.status, k.source, k.client_tz
        FROM public.bk_bookings k JOIN public.bk_types t ON t.id = k.type_id
        WHERE k.ends_at > now() - interval '7 days' ORDER BY k.starts_at LIMIT 200`, true);
      return Response.json({ bookings: rows });
    }

    if (a === "detail") {
      const keys = await loadKeys();
      if (!keys.ok) throw new Error(KEYS_MSG);
      const id = textField(body, "id", { max: 40 });
      const [booking] = await runSql(base44, `SELECT k.id, t.name AS type, t.zoom_link, k.starts_at, k.first_name, k.email, k.status FROM public.bk_bookings k
        JOIN public.bk_types t ON t.id = k.type_id WHERE k.id = ${escStr(id)}::uuid`, true);
      if (!booking) return Response.json({ error: "Nie znaleziono" }, { status: 404 });
      const d = await rpc(base44, "bk_admin_detail", { p_id: id });
      const health = d?.health_enc ? await decryptHealth(keys.enc, d.health_enc).catch(() => null) : null;
      await log(base44, me.email, "odczyt_odpowiedzi", "booking", id, null);
      return Response.json({ booking, detail: { answers: d?.answers ?? null, health_consent: d?.health_consent ?? false, deleted_at: d?.deleted_at ?? null, health } });
    }

    // Rezerwacja przez admina: może pominąć 24 h, ale nie zająć zajętego terminu (te same reguły w bk_book).
    if (a === "book") {
      const r = await rpc(base44, "bk_book", { p: {
        type_id: textField(body, "type_id", { max: 40 }), starts_at: iso(body.starts_at), email: emailField(body).toLowerCase(),
        first_name: textField(body, "first_name", { max: 120 }), viewer_admin: true, source: "admin", actor: me.email,
      } });
      return Response.json(r, { status: r?.error ? 409 : 200 });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    if (e.message === "FORBIDDEN") return Response.json({ error: "Forbidden" }, { status: 403 });
    console.error("bookingAdmin:", safeErr(e));
    const userMsg = /^(Niepoprawn|Koniec|Podaj|Godziny|Link Zoom|Adres|Brak pola|Pole|Rezerwacje)/.test(e.message) ? e.message : "Nie udało się zapisać.";
    return Response.json({ error: userMsg }, { status: 400 });
  }
}