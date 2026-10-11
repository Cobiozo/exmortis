import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, rpc, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { loadKeys, sha256hex, safeEqual, randomToken, getMode, safeErr, CONSENTS, TZ_RE, KEYS_MSG } from "../../shared/booking.ts";
import { encryptHealth } from "../../shared/bookingCrypto.ts";

// Publiczne rezerwacje 1:1. Zwraca wyłącznie godziny i dane potrzebne formularzowi — nigdy linku Zoom ani cudzych danych.
const ERR = {
  taken: [409, "Ten termin właśnie się zajął. Wybierz inny."],
  one_per_email: [409, "Masz już zarezerwowaną rozmowę tego rodzaju."],
  disabled: [404, "Nie znaleziono"],
  not_found: [404, "Nie znaleziono"],
  access: [403, "Ten rodzaj spotkania nie jest dostępny publicznie."],
};
const bad = (msg, status = 400) => Response.json({ error: msg }, { status });

async function getType(base44, slug, admin) {
  const rows = await runSql(base44,
    `SELECT id, slug, name, description, duration_min, questions, access, active FROM public.bk_types WHERE slug = ${escStr(slug)}`, true);
  const t = rows?.[0];
  if (!t || t.access !== "PUBLICZNY" || (!t.active && !admin)) return null;
  return t;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const a = body.action;

    // Zadanie cykliczne: święta 2 lata do przodu, czyszczenie rejestru po 12 mies., usuwanie odpowiedzi po 60 dniach.
    // Dostęp: administrator albo zadanie RezerwacjeTick (token z bk_settings, porównanie w czasie stałym).
    // Anonimowe wywołanie kończy się 403 (wcześniej każdy mógł wywołać higienę danych).
    if (a === "tick") {
      const who = await base44.auth.me().catch(() => null);
      let allowed = who?.role === "admin";
      if (!allowed) {
        const [row] = await runSql(base44, `SELECT tick_token FROM public.bk_settings WHERE id = 1`, true);
        const given = typeof body.tick_token === "string" ? body.tick_token : "";
        allowed = !!row?.tick_token && !!given && (await safeEqual(given, row.tick_token));
      }
      if (!allowed) return bad("Forbidden", 403);
      const r = await runSql(base44, `SELECT public.bk_fill_holidays(2) AS holidays, public.bk_log_purge() AS log_purged, public.bk_answers_retention() AS answers_removed, backup.purge_expired() AS backups_removed`);
      return Response.json({ ok: true, ...(r?.[0] || {}) });
    }

    const me = await base44.auth.me().catch(() => null);
    const admin = me?.role === "admin";
    const mode = await getMode(base44);
    const visible = mode === "on" || (mode === "admin" && admin);
    if (a === "config") return Response.json({ enabled: visible });
    if (!visible) return bad("Nie znaleziono", 404);

    if (a === "type") {
      const t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      if (!t) return bad("Nie znaleziono", 404);
      const questions = (t.questions || []).map((q) => ({ id: q.id, label: q.label, required: !!q.required, health: !!q.health }));
      return Response.json({ type: { slug: t.slug, name: t.name, description: t.description, duration_min: t.duration_min, questions } });
    }

    if (a === "slots") {
      const t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      if (!t) return bad("Nie znaleziono", 404);
      const from = new Date(body.from || Date.now());
      const to = new Date(Math.min(new Date(body.to || Date.now() + 31 * 864e5).getTime(), from.getTime() + 62 * 864e5));
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return bad("Niepoprawny zakres");
      const rows = await rpc(base44, "bk_free_slots", { p_type: t.id, p_from: from.toISOString(), p_to: to.toISOString() });
      return Response.json({ slots: (rows || []).map((r) => ({ start: r.slot_start, end: r.slot_end })) });
    }

    if (a === "book") {
      const keys = await loadKeys(admin && body.simulate_missing_keys === true);
      if (!keys.ok) return bad(KEYS_MSG, 503);
      if (body.website) return Response.json({ ok: true });
      const t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      if (!t) return bad("Nie znaleziono", 404);
      let firstName, email;
      try {
        firstName = textField(body, "first_name", { max: 120 });
        email = emailField(body).toLowerCase();
      } catch (e) { return bad(e.message.startsWith("Brak") ? "Uzupełnij imię i e-mail." : e.message); }
      const ip = clientIp(req);
      const rate = await rpc(base44, "bk_rate_hit", { p_ip: await keys.hmac(ip), p_email: await keys.hmac(email) });
      if (rate !== "ok") return bad("Za dużo prób w krótkim czasie. Spróbuj ponownie za kilka minut.", 429);
      if (body.consent !== true) return bad("Zaznacz akceptację regulaminu i polityki prywatności.");
      const st = new Date(body.starts_at);
      if (isNaN(st.getTime())) return bad("Wybierz termin.");
      const answers = {}; let health = null;
      for (const q of t.questions || []) {
        const v = typeof body.answers?.[q.id] === "string" ? body.answers[q.id].trim() : "";
        if (v.length > 2000) return bad("Odpowiedź jest zbyt długa (maks. 2000 znaków).");
        if (q.required && !v) return bad(`Odpowiedz na pytanie: ${q.label}`);
        if (q.health) health = v || null; else if (v) answers[q.id] = v;
      }
      if (health && body.health_consent !== true) return bad("Zaznacz zgodę na dane o zdrowiu albo zostaw to pytanie puste.");
      const emailH = await keys.hmac(email), ipH = await keys.hmac(ip);
      const consents = [{ kind: "regulamin", text_version: CONSENTS.regulamin.version, text: CONSENTS.regulamin.text, email_hmac: emailH, ip_hmac: ipH }];
      if (health) consents.push({ kind: "zdrowie", text_version: CONSENTS.zdrowie.version, text: CONSENTS.zdrowie.text, email_hmac: emailH, ip_hmac: ipH });
      const token = randomToken();
      const idem = typeof body.idem_key === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.idem_key) ? body.idem_key : null;
      const health_enc = health ? await encryptHealth(keys.enc, health) : null;
      const res = await rpc(base44, "bk_book", { p: {
        type_id: t.id, starts_at: st.toISOString(), email, first_name: firstName, user_id: me?.id || null,
        tz: typeof body.tz === "string" && TZ_RE.test(body.tz) ? body.tz : null, idem_key: idem, viewer_admin: admin,
        source: "klient", actor: "klient", answers, health_enc, health_consent: !!health,
        consents, token_hash: await sha256hex(token),
      } });
      if (res?.error) { const [c, m] = ERR[res.error] || [400, "Nie udało się zarezerwować."]; return bad(m, c); }
      return Response.json({ ok: true, starts_at: res.starts_at, ends_at: res.ends_at,
        manage_url: res.already ? null : `/rezerwacja/zarzadzaj#t=${token}` });
    }

    if (a === "manage") {
      const tok = typeof body.token === "string" ? body.token : "";
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest nieważny.", 404);
      const r = await rpc(base44, "bk_manage_view", { p_hash: await sha256hex(tok) });
      if (!r) return bad("Link jest nieważny.", 404);
      return Response.json({ booking: r });
    }

    return bad("Nieznana akcja");
  } catch (e) {
    console.error("bookingPublic:", safeErr(e));
    return Response.json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, { status: 500 });
  }
}