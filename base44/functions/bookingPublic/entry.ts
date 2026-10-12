import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runSql, rpc, escStr, textField, emailField, clientIp } from "../../shared/supabase.ts";
import { loadKeys, sha256hex, safeEqual, randomToken, getMode, safeErr, CONSENTS, TZ_RE, KEYS_MSG } from "../../shared/booking.ts";
import { encryptHealth } from "../../shared/bookingCrypto.ts";
import { icalFeed } from "../../shared/bookingIcal.ts";
import { onBookingCreated, onBookingMoved, onBookingCancelled, runReminders } from "../../shared/bookingNotify.ts";
import { ensureCalendar, syncBooking, dropBusy, takenByGoogle, typeDuration, retryGoogle } from "../../shared/bookingGoogle.ts";

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

// Pakiet wskazany identyfikatorem albo jednorazowym tokenem. Samo id pakietu nigdy nie daje
// dostępu — właściciela sprawdzamy tutaj, a potem ponownie w funkcji bazy.
async function resolvePackage(base44, body, me, admin) {
  const tok = typeof body.token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(body.token) ? body.token : null;
  if (tok) {
    const r = await rpc(base44, "bk_token_package", { p_hash: await sha256hex(tok) });
    return r ? { package_id: r.package_id, type_id: r.type_id, email: r.email, from_token: true } : null;
  }
  if (body.package_id) {
    const rows = await runSql(base44,
      `SELECT id, type_id, user_id, email_display FROM public.bk_packages WHERE id = ${escStr(textField(body, "package_id", { max: 40 }))}::uuid`, true);
    const p = rows?.[0];
    if (!p) return null;
    if (!admin) {
      const mine = (me?.id && p.user_id === me.id)
        || (me?.email && (p.email_display || "").toLowerCase() === String(me.email).toLowerCase());
      if (!mine) return null;
    }
    return { package_id: p.id, type_id: p.type_id, email: p.email_display, from_token: false };
  }
  return null;
}

// Najwcześniejszy dozwolony termin w pakiecie: ostatnia sesja + odstęp (min_gap_days).
// Ta sama reguła co w bk_book_package — tu tylko po to, by nie pokazywać terminów, których i tak nie da się zarezerwować.
async function packageEarliest(base44, packageIds) {
  const ids = (packageIds || []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x)));
  if (!ids.length) return {};
  const rows = await runSql(base44,
    `SELECT pk.id, pk.min_gap_days, (SELECT max(k.starts_at) FROM public.bk_bookings k WHERE k.package_id = pk.id AND k.status IN ('POTWIERDZONA','ODBYLA_SIE')) AS last_start
     FROM public.bk_packages pk WHERE pk.id IN (${ids.map((x) => `${escStr(x)}::uuid`).join(",")})`, true);
  const out = {};
  for (const r of rows || []) {
    const gap = Number(r.min_gap_days) || 0;
    out[r.id] = {
      last_start: r.last_start || null,
      earliest: r.last_start && gap > 0 ? new Date(new Date(r.last_start).getTime() + gap * 864e5).toISOString() : null,
    };
  }
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Prywatny kanał iCal (MUSI 6): zwykłe pobranie GET pod tajnym adresem.
    // W treści wyłącznie rodzaj spotkania i imię — nigdy adresu ani odpowiedzi z formularza.
    const icalToken = new URL(req.url).searchParams.get("ical");
    if (icalToken) return await icalFeed(base44, icalToken);
    const body = await req.json().catch(() => ({}));
    const a = body.action;

    // Zadanie cykliczne: święta 2 lata do przodu, czyszczenie rejestru po 12 mies., usuwanie odpowiedzi po 60 dniach.
    // Dostęp: administrator albo zadanie RezerwacjeTick (token z bk_settings, porównanie w czasie stałym).
    // Anonimowe wywołanie kończy się 403 (wcześniej każdy mógł wywołać higienę danych).
    if (a === "tick" || a === "notify_tick") {
      const who = await base44.auth.me().catch(() => null);
      let allowed = who?.role === "admin";
      if (!allowed) {
        const [row] = await runSql(base44, `SELECT tick_token FROM public.bk_settings WHERE id = 1`, true);
        const given = typeof body.tick_token === "string" ? body.tick_token : "";
        allowed = !!row?.tick_token && !!given && (await safeEqual(given, row.tick_token));
      }
      if (!allowed) return bad("Forbidden", 403);
      // Przypomnienia 24 h i 1 h (MUSI 15) oraz ponowienia do Kalendarza Google (MUSI 6) — ten sam token.
      if (a === "notify_tick") return Response.json({ ok: true, ...(await runReminders(base44)), ...(await retryGoogle(base44)) });
      const r = await runSql(base44, `SELECT public.bk_fill_holidays(2) AS holidays, public.bk_log_purge() AS log_purged, public.bk_answers_retention() AS answers_removed, backup.purge_expired() AS backups_removed`);
      await ensureCalendar(base44).catch(() => {});   // własny kalendarz „exmortis · sesje” powstaje raz
      return Response.json({ ok: true, ...(r?.[0] || {}), ...(await retryGoogle(base44)) });
    }

    const me = await base44.auth.me().catch(() => null);
    const admin = me?.role === "admin";
    const mode = await getMode(base44);
    const visible = mode === "on" || (mode === "admin" && admin);
    if (a === "config") return Response.json({ enabled: visible });
    // „Umów indywidualne spotkanie” w koncie działa zawsze: przy wyłączonym module zwraca tylko
    // informację, czy osoba ma przyznany dostęp (bez terminów i bez możliwości rezerwacji).
    if (a === "my_sessions" && !visible) {
      if (!me) return bad("Zaloguj się, aby zobaczyć swoje sesje.", 401);
      const r = await rpc(base44, "bk_my_sessions", { p: { user_id: me.id, email: String(me.email || "").toLowerCase() } }).catch(() => null);
      return Response.json({ off: true, has_access: (r?.packages || []).some((p) => p.sessions_left > 0), packages: [], bookings: [] });
    }
    if (!visible) return bad("Nie znaleziono", 404);

    if (a === "type") {
      const t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      if (!t) return bad("Nie znaleziono", 404);
      const questions = (t.questions || []).map((q) => ({ id: q.id, label: q.label, required: !!q.required, health: !!q.health }));
      return Response.json({ type: { slug: t.slug, name: t.name, description: t.description, duration_min: t.duration_min, questions } });
    }

    if (a === "slots") {
      let t = null, earliest = null;
      if (body.slug) t = await getType(base44, textField(body, "slug", { max: 60 }), admin);
      else if (body.manage_token) {
        const tok = typeof body.manage_token === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(body.manage_token) ? body.manage_token : null;
        const v = tok ? await rpc(base44, "bk_manage_view", { p_hash: await sha256hex(tok) }) : null;
        if (v?.id) t = (await runSql(base44, `SELECT id, slug, name, duration_min FROM public.bk_types WHERE id = (SELECT type_id FROM public.bk_bookings WHERE id = ${escStr(v.id)}::uuid)`, true))?.[0] || null;
      } else if (body.booking_id) {
        const own = admin ? "TRUE" : `(user_id = ${me?.id ? escStr(me.id) : "NULL"} OR lower(btrim(COALESCE(email,''))) = ${escStr(String(me?.email || "").toLowerCase())})`;
        const rows = await runSql(base44, `SELECT type_id FROM public.bk_bookings WHERE id = ${escStr(textField(body, "booking_id", { max: 40 }))}::uuid AND ${own}`, true);
        if (rows?.[0]) t = (await runSql(base44, `SELECT id, slug, name, duration_min FROM public.bk_types WHERE id = ${escStr(rows[0].type_id)} AND (active OR ${admin ? "TRUE" : "FALSE"})`, true))?.[0] || null;
      } else {
        const pk = await resolvePackage(base44, body, me, admin);
        if (pk) {
          t = (await runSql(base44, `SELECT id, slug, name, duration_min FROM public.bk_types WHERE id = ${escStr(pk.type_id)} AND (active OR ${admin ? "TRUE" : "FALSE"})`, true))?.[0] || null;
          earliest = (await packageEarliest(base44, [pk.package_id]))[pk.package_id]?.earliest || null;
        }
      }
      if (!t) return bad("Nie znaleziono", 404);
      let from = new Date(body.from || Date.now());
      if (earliest && new Date(earliest) > from) from = new Date(earliest);
      const to = new Date(Math.min(new Date(body.to || from.getTime() + 31 * 864e5).getTime(), from.getTime() + 62 * 864e5));
      if (isNaN(from.getTime()) || isNaN(to.getTime())) return bad("Niepoprawny zakres");
      if (to <= from) return Response.json({ slots: [], earliest });
      const rows = await rpc(base44, "bk_free_slots", { p_type: t.id, p_from: from.toISOString(), p_to: to.toISOString() });
      const slots = (rows || []).map((r) => ({ start: r.slot_start, end: r.slot_end }))
        .filter((s) => !earliest || new Date(s.start) >= new Date(earliest));
      // Zajętość z kalendarza głównego działa jak ręczna blokada; brak odpowiedzi Google nic nie blokuje.
      return Response.json({ slots: await dropBusy(base44, slots, from.toISOString(), to.toISOString()), earliest });
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
      // Ostatni sprawdzian zajętości Google — bez pamięci podręcznej, tuż przed zapisem.
      if (await takenByGoogle(base44, st.toISOString(), new Date(st.getTime() + t.duration_min * 60000).toISOString())) return bad(ERR.taken[1], 409);
      const res = await rpc(base44, "bk_book", { p: {
        type_id: t.id, starts_at: st.toISOString(), email, first_name: firstName, user_id: me?.id || null,
        tz: typeof body.tz === "string" && TZ_RE.test(body.tz) ? body.tz : null, idem_key: idem, viewer_admin: admin,
        source: "klient", actor: "klient", answers, health_enc, health_consent: !!health,
        consents, token_hash: await sha256hex(token),
      } });
      if (res?.error) { const [c, m] = ERR[res.error] || [400, "Nie udało się zarezerwować."]; return bad(m, c); }
      // Potwierdzenie z plikiem .ics, przypomnienia i powiadomienie do mnie (MUSI 15).
      if (!res.already && res.id) await onBookingCreated(base44, res.id, token, "klient").catch(() => {});
      if (!res.already && res.id) await syncBooking(base44, res.id, "upsert").catch(() => {});
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

    // ---- KROK 2: pakiety, „Rozmowa na progu”, przenoszenie i anulowanie ----

    // Pakiet po jednorazowym tokenie z zamówienia (w bazie tylko skrót).
    if (a === "order") {
      const tok = typeof body.token === "string" ? body.token : "";
      if (!/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest nieważny.", 404);
      const r = await rpc(base44, "bk_token_package", { p_hash: await sha256hex(tok) });
      if (!r) return bad("Link jest nieważny albo został już użyty.", 404);
      return Response.json({ package: r });
    }

    // „Moje sesje” — wyłącznie dla zalogowanego właściciela (user_id albo e-mail konta).
    if (a === "my_sessions") {
      if (!me) return bad("Zaloguj się, aby zobaczyć swoje sesje.", 401);
      const r = await rpc(base44, "bk_my_sessions", { p: { user_id: me.id, email: String(me.email || "").toLowerCase() } });
      const out = r || { packages: [], bookings: [] };
      const early = await packageEarliest(base44, (out.packages || []).map((p) => p.id)).catch(() => ({}));
      out.packages = (out.packages || []).map((p) => ({ ...p, next_possible: early[p.id]?.earliest || null }));
      out.has_access = out.packages.some((p) => p.sessions_left > 0);
      return Response.json(out);
    }

    if (a === "book_package") {
      const keys = await loadKeys(admin && body.simulate_missing_keys === true);
      if (!keys.ok) return bad(KEYS_MSG, 503);
      if (body.website) return Response.json({ ok: true });
      const tok = typeof body.token === "string" && body.token ? body.token : null;
      if (tok && !/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest nieważny.", 404);
      if (!me && !tok) return bad("Zaloguj się, aby zarezerwować termin.", 401);
      const st = new Date(body.starts_at);
      if (isNaN(st.getTime())) return bad("Wybierz termin.");
      let firstName;
      try { firstName = textField(body, "first_name", { max: 120 }); } catch { return bad("Uzupełnij imię."); }
      const ip = clientIp(req);
      const emailForRate = String(me?.email || body.email || "").toLowerCase();
      if (emailForRate) {
        const rate = await rpc(base44, "bk_rate_hit", { p_ip: await keys.hmac(ip), p_email: await keys.hmac(emailForRate) });
        if (rate !== "ok") return bad("Za dużo prób w krótkim czasie. Spróbuj ponownie za kilka minut.", 429);
      }
      const emailH = await keys.hmac(emailForRate || "brak"), ipH = await keys.hmac(ip);
      const consents = [];
      if (body.service_consent === true) {
        consents.push({ kind: "odstapienie", text_version: String(body.consent_version || "").slice(0, 40), text: String(body.consent_text || "").slice(0, 2000), email_hmac: emailH, ip_hmac: ipH });
      }
      const pkRow = await resolvePackage(base44, body, me, admin);
      const dur = pkRow ? await typeDuration(base44, pkRow.type_id) : null;
      if (dur && await takenByGoogle(base44, st.toISOString(), new Date(st.getTime() + dur * 60000).toISOString())) {
        return bad("Ten termin jest zajęty w Twoim kalendarzu Google.", 409);
      }
      const res = await rpc(base44, "bk_book_package", { p: {
        package_id: tok ? null : textField(body, "package_id", { max: 40 }),
        token_hash: tok ? await sha256hex(tok) : null,
        starts_at: st.toISOString(),
        user_id: me?.id || null, email: String(me?.email || "").toLowerCase() || null, first_name: firstName,
        tz: typeof body.tz === "string" && TZ_RE.test(body.tz) ? body.tz : null,
        viewer_admin: admin, source: "klient", actor: "klient", consents,
      } });
      if (res?.error) {
        const map = {
          forbidden: [403, "Ten pakiet należy do innego konta."],
          not_found: [404, "Nie znaleziono pakietu."],
          unpaid: [409, "Płatność za pakiet nie została potwierdzona."],
          expired: [409, "Ważność pakietu się skończyła."],
          used_up: [409, "Wszystkie sesje z pakietu są już wykorzystane."],
          consent: [400, "Zaznacz zgodę o wykonaniu usługi przed upływem 14 dni."],
          gap: [409, `Odstęp między sesjami to co najmniej ${res.min_days} dni.`],
          taken: [409, "Ten termin właśnie się zajął. Wybierz inny."],
        };
        const [c, m] = map[res.error] || [400, "Nie udało się zarezerwować."];
        return bad(m, c);
      }
      if (res.id) await onBookingCreated(base44, res.id, null, "klient").catch(() => {});
      if (res.id) await syncBooking(base44, res.id, "upsert").catch(() => {});
      return Response.json({ ok: true, starts_at: res.starts_at, ends_at: res.ends_at });
    }

    // Przeniesienie i anulowanie: token z linku (krok 1) albo zalogowany właściciel.
    if (a === "reschedule" || a === "cancel") {
      const tok = typeof body.token === "string" && body.token ? body.token : null;
      if (tok && !/^[A-Za-z0-9_-]{20,100}$/.test(tok)) return bad("Link jest nieważny.", 404);
      if (!me && !tok) return bad("Zaloguj się, aby zmienić rezerwację.", 401);
      let bookingId = body.booking_id ? textField(body, "booking_id", { max: 40 }) : null;
      if (!bookingId && tok) {
        const v = await rpc(base44, "bk_manage_view", { p_hash: await sha256hex(tok) });
        bookingId = v?.id || null;
      }
      if (!bookingId) return bad("Nie znaleziono rezerwacji.", 404);
      const p = {
        booking_id: bookingId, user_id: me?.id || null, email: String(me?.email || "").toLowerCase() || null,
        viewer_admin: admin, actor: admin ? me.email : "klient",
      };
      if (a === "reschedule") {
        const st = new Date(body.starts_at);
        if (isNaN(st.getTime())) return bad("Wybierz nowy termin.");
        p.starts_at = st.toISOString();
      }
      const res = await rpc(base44, a === "reschedule" ? "bk_reschedule" : "bk_cancel", { p });
      if (res?.error) {
        const map = {
          forbidden: [403, "Ta rezerwacja należy do innego konta."],
          not_found: [404, "Nie znaleziono rezerwacji."],
          too_late: [409, `Do spotkania zostało mniej niż ${(body.change_window_h || 24)} godzin — napisz do mnie.`],
          limit: [409, `Limit przełożeń (${res.max}) został wykorzystany.`],
          expired: [409, "Ważność pakietu się skończyła."],
          taken: [409, "Ten termin właśnie się zajął. Wybierz inny."],
        };
        const [c, m] = map[res.error] || [400, "Nie udało się zmienić rezerwacji."];
        return bad(m, c);
      }
      // iCal: ten sam UID, SEQUENCE + 1. Przypomnienia liczone od nowego terminu, stare anulowane.
      await runSql(base44, `UPDATE public.bk_bookings SET ics_sequence = ics_sequence + 1 WHERE id = ${escStr(bookingId)}::uuid`).catch(() => {});
      if (a === "reschedule") await onBookingMoved(base44, bookingId).catch(() => {});
      else await onBookingCancelled(base44, bookingId).catch(() => {});
      // Google: przeniesienie poprawia to samo wydarzenie, anulowanie je usuwa.
      await syncBooking(base44, bookingId, a === "reschedule" ? "upsert" : "delete").catch(() => {});
      return Response.json(res);
    }

    return bad("Nieznana akcja");
  } catch (e) {
    console.error("bookingPublic:", safeErr(e));
    return Response.json({ error: "Coś poszło nie tak. Spróbuj ponownie." }, { status: 500 });
  }
}