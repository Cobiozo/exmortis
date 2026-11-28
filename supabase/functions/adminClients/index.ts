import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireAdmin, listAuthUsers } from "../_shared/supabase.ts";
import { grantAccess, isActive, ensureAccount } from "../_shared/access.ts";
import { mirrorRecord, accessFilter, accessGet } from "../_shared/mirror.ts";
import { expandBundles } from "../_shared/bundles.ts";
import { sendMail } from "../_shared/smtp.ts";
import { APP_URL } from "../_shared/settings.ts";

function addMonths(ymd: string, m: number) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + m, d)).toISOString().slice(0, 10);
}

// Panel klientów: lista, szczegóły, ręczne nadanie / przedłużenie / odebranie dostępu.
const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44).catch(() => null);
    if (!admin) return Response.json({ error: "Brak dostępu" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;
    const email = String(body.email || "").toLowerCase().trim();

    if (body.action === "list") {
      const res = await sr.Access.aggregate({ groupBy: "user_email", sort: "-count", limit: 1000 });
      return Response.json({ clients: res.rows.map((r) => ({ email: r.user_email, count: r.count })) });
    }

    // Konta: Supabase Auth + profil (exm_user) + aktywne dostępy + blokady z panelu.
    // Wyłącznie administrator (requireAdmin na wejściu), bez haseł, tokenów, metadanych i IP.
    if (body.action === "accounts") {
      const users: any[] = await listAuthUsers();
      const profiles = await runSql(base44,
        `SELECT lower(data->>'email') AS email, data->>'full_name' AS full_name, data->>'role' AS role
           FROM public.exm_user WHERE data->>'email' IS NOT NULL`, true).catch(() => []);
      const accesses = await runSql(base44,
        `SELECT lower(data->>'user_email') AS email, count(*)::int AS n FROM public.exm_access
          WHERE COALESCE((data->>'revoked')::boolean, false) = false
            AND (COALESCE(data->>'valid_until', '') = ''
                 OR data->>'valid_until' >= to_char((now() AT TIME ZONE 'Europe/Warsaw'), 'YYYY-MM-DD'))
          GROUP BY 1`, true).catch(() => []);
      const blocks = await sr.SecurityLog.filter({ type: "blokada", resolved: false }, "-created_date", 300).catch(() => []);
      const profMap = new Map(profiles.map((p) => [String(p.email || "").toLowerCase(), p]));
      const accMap = new Map(accesses.map((r) => [String(r.email || "").toLowerCase(), Number(r.n) || 0]));
      const now = Date.now();
      const blockMap = new Map();
      for (const b of blocks) {
        const until = b.until ? new Date(b.until).getTime() : 0;
        if (until > now) blockMap.set(String(b.user_email || "").toLowerCase(), b.until);
      }
      const ROLE = { admin: "admin", techniczna: "techniczna", user: "klient" };
      const PROVIDER = { email: "E-mail", google: "Google", facebook: "Facebook", apple: "Apple", microsoft: "Microsoft", github: "GitHub" };
      const list = users.map((u) => {
        const mail = String(u.email || "").toLowerCase();
        const p = profMap.get(mail);
        const provider = String(u.app_metadata?.provider || u.identities?.[0]?.provider || "email");
        const banned = u.banned_until ? new Date(u.banned_until).getTime() > now : false;
        return {
          id: u.id,
          email: mail,
          name: String(p?.full_name || u.user_metadata?.full_name || ""),
          role: ROLE[String(p?.role || "user")] || "klient",
          created_at: u.created_at || null,
          last_sign_in_at: u.last_sign_in_at || null,
          email_confirmed: !!u.email_confirmed_at,
          provider: PROVIDER[provider] || provider,
          blocked: banned || blockMap.has(mail),
          accesses: accMap.get(mail) || 0,
        };
      }).sort((x, y) => String(y.created_at || "").localeCompare(String(x.created_at || "")));
      // Konta testowe (28.11.2026): te same reguły co w zamówieniach (public.exm_test_email).
      const mails = list.map((a) => a.email).filter(Boolean);
      const tests = mails.length ? await runSql(base44, `SELECT e FROM unnest(ARRAY[${mails.map(escStr).join(",")}]::text[]) e WHERE public.exm_test_email(e)`, true).catch(() => []) : [];
      const testSet = new Set((tests || []).map((r) => String(r.e)));
      for (const a of list) a.test = testSet.has(a.email);
      const weekAgo = now - 7 * 86400000;
      return Response.json({
        accounts: list,
        counts: {
          total: list.filter((a) => !a.test).length,
          tests: list.filter((a) => a.test).length,
          new7: list.filter((a) => !a.test && a.created_at && new Date(a.created_at).getTime() >= weekAgo).length,
          logins7: list.filter((a) => !a.test && a.last_sign_in_at && new Date(a.last_sign_in_at).getTime() >= weekAgo).length,
        },
      });
    }

    // Karta klienta 360° (28.11.2026): wszystko o osobie w jednym miejscu — oś czasu i notatka.
    if (body.action === "timeline") {
      if (!email.includes("@")) return Response.json({ error: "Podaj e-mail" }, { status: 400 });
      const e = escStr(email);
      const part = (sql) => runSql(base44, sql, true).catch(() => []);
      const [orders, regs, subs, powrot, prog, podcast, msgs, bookings, notes, test] = await Promise.all([
        part(`SELECT o.id::text AS id, o.created_date AS at, o.status, o.total::float8 AS total, to_jsonb(o)->>'discount_code' AS code,
            (SELECT string_agg(it->>'name', ', ') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) it) AS items,
            public.exm_test_order(o) AS test
          FROM public.orders o WHERE lower(o.buyer_email) = ${e} ORDER BY o.created_date DESC LIMIT 100`),
        part(`SELECT r.created_at AS at, r.status, ev.title, ev.start_datetime FROM public.registrations r LEFT JOIN public.events ev ON ev.id = r.event_id
          WHERE lower(r.email) = ${e} ORDER BY r.created_at DESC LIMIT 100`),
        part(`SELECT status, created_date AS at, confirmed_at FROM public.subscribers WHERE lower(email) = ${e} LIMIT 1`),
        part(`SELECT id::text AS id, created_date AS at, status FROM public.powrot_applications WHERE lower(email) = ${e} ORDER BY created_date DESC`),
        part(`SELECT id::text AS id, created_date AS at, status FROM public.prog_applications WHERE lower(email) = ${e} ORDER BY created_date DESC`),
        part(`SELECT id::text AS id, created_date AS at, data->>'status' AS status FROM public.exm_podcastapplication WHERE lower(data->>'email') = ${e} ORDER BY created_date DESC`),
        part(`SELECT id::text AS id, created_date AS at, COALESCE(status, 'nowa') AS status, left(message, 140) AS preview FROM public.contact_messages WHERE lower(email) = ${e} ORDER BY created_date DESC`),
        part(`SELECT b.starts_at AS at, b.status, t.name FROM public.bk_bookings b LEFT JOIN public.bk_types t ON t.id = b.type_id
          WHERE lower(COALESCE(b.email_norm, b.email)) = ${e} ORDER BY b.starts_at DESC LIMIT 50`),
        part(`SELECT note, tags, updated_at FROM public.client_notes WHERE email = ${e}`),
        part(`SELECT public.exm_test_email(${e}) AS t`),
      ]);
      const paid = (orders || []).filter((o) => o.status === "COMPLETED" && !o.test && Number(o.total) > 0);
      return Response.json({
        test: !!test?.[0]?.t,
        totals: { spent: Math.round(paid.reduce((n, o) => n + Number(o.total || 0), 0) * 100) / 100, orders: paid.length },
        subscriber: subs?.[0] || null,
        note: notes?.[0] || null,
        orders: orders || [], registrations: regs || [], powrot: powrot || [], prog: prog || [], podcast: podcast || [],
        messages: msgs || [], bookings: bookings || [],
      });
    }
    if (body.action === "note_save") {
      if (!email.includes("@")) return Response.json({ error: "Podaj e-mail" }, { status: 400 });
      const note = String(body.note || "").slice(0, 8000);
      const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 20) : [];
      const tagSql = tags.length ? `ARRAY[${tags.map(escStr).join(",")}]::text[]` : `'{}'::text[]`;
      await runSql(base44, `INSERT INTO public.client_notes (email, note, tags, updated_at) VALUES (${escStr(email)}, ${escStr(note)}, ${tagSql}, now())
        ON CONFLICT (email) DO UPDATE SET note = EXCLUDED.note, tags = EXCLUDED.tags, updated_at = now()`);
      return Response.json({ ok: true });
    }

    if (body.action === "detail") {
      const access = await accessFilter(base44, { user_email: email }, "-created_date", 200);
      const logs = await sr.PlaybackLog.filter({ user_email: email }, "-created_date", 50);
      const progress = await sr.LessonProgress.filter({ user_email: email, completed: true }, "-updated_date", 300);
      const user = (await sr.User.filter({ email }))[0];
      return Response.json({
        user: user ? { full_name: user.full_name, created_date: user.created_date } : null,
        access: access.map((a) => ({ ...a, active: isActive(a) })),
        logs, completed: progress.length,
      });
    }

    // ---- Rola konta (16.11.2026) ----
    // Zmienia wyłącznie administrator; nie można zmienić własnej roli ani odebrać uprawnień ostatniemu
    // administratorowi. Każda zmiana trafia do dziennika bezpieczeństwa. Rola jest czytana przez serwer
    // wyłącznie z profilu (exm_user.data.role) — przeglądarka nie może jej zmienić (wyzwalacz exm_user_role_guard).
    if (body.action === "role" || body.action === "set_role") {
      if (!email.includes("@")) return Response.json({ error: "Podaj e-mail" }, { status: 400 });
      const rows = await runSql(base44, `SELECT data->>'role' AS role FROM public.exm_user WHERE lower(data->>'email') = ${escStr(email)} LIMIT 1`, true);
      if (!rows.length) return Response.json({ error: "To konto nie ma jeszcze profilu." }, { status: 404 });
      const raw = String(rows[0].role || "user");
      const cur = ["admin", "techniczna"].includes(raw) ? raw : "user";
      const self = email === String(admin.email || "").toLowerCase();
      const locked = raw === "zablokowane"; // konto nieaktywne — tej roli nie zmieniamy z tego miejsca
      if (body.action === "role") return Response.json({ role: cur, self, locked });
      if (locked) return Response.json({ error: "Konto jest nieaktywne — rola nie może być tu zmieniona." }, { status: 400 });

      const role = String(body.role || "");
      if (!["admin", "techniczna", "user"].includes(role)) return Response.json({ error: "Nieznana rola." }, { status: 400 });
      if (self) return Response.json({ error: "Nie możesz zmienić własnej roli." }, { status: 400 });
      if (role === cur) return Response.json({ ok: true, role });
      if (cur === "admin") {
        const [c] = await runSql(base44, `SELECT COUNT(*)::int AS n FROM public.exm_user WHERE data->>'role' = 'admin'`, true);
        if (Number(c?.n || 0) <= 1) return Response.json({ error: "To ostatni administrator — najpierw nadaj rolę admin innemu kontu." }, { status: 400 });
      }
      await runSql(base44, `UPDATE public.exm_user SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{role}', to_jsonb(${escStr(role)}::text), true), updated_date = now()
        WHERE lower(data->>'email') = ${escStr(email)}`);
      const LABEL = { admin: "admin", techniczna: "techniczna", user: "klient" };
      await sr.SecurityLog.create({
        type: "rola", user_email: email, ip: "", resolved: true,
        details: `zmiana roli: ${LABEL[cur]} → ${LABEL[role]} · ${admin.email}`,
      }).catch(() => {});
      return Response.json({ ok: true, role });
    }

    if (body.action === "security") {
      const alerts = await sr.SecurityLog.filter({ type: { $in: ["blokada", "wspoldzielenie", "znak_wodny", "wideo_limit", "rabat"] } }, "-created_date", 100);
      return Response.json({ alerts });
    }

    if (body.action === "block") {
      if (!email.includes("@")) return Response.json({ error: "Podaj e-mail" }, { status: 400 });
      const days = [1, 7, 30].includes(Number(body.days)) ? Number(body.days) : 7;
      const until = new Date(Date.now() + days * 86400000).toISOString();
      // Jedna aktywna blokada na konto — poprzednie zdejmujemy, żeby nie mnożyć wpisów.
      const prev = await sr.SecurityLog.filter({ type: "blokada", user_email: email, resolved: false }, "-created_date", 20);
      for (const p of prev) await sr.SecurityLog.update(p.id, { resolved: true });
      await sr.SecurityLog.create({
        type: "blokada", user_email: email, ip: "", until, resolved: false,
        details: `blokada ręczna na ${days === 1 ? "24 h" : `${days} dni`} · ${admin.email}`,
      });
      // Klient dostaje informację o wstrzymaniu odtwarzania — z terminem i drogą odwołania.
      const do_ = new Date(until).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
      await sendMail(base44, {
        kind: "blokada", ref: email, to: email,
        subject: "exmortis — odtwarzanie materiałów zostało wstrzymane",
        html: `<div style="background:#0A0A0B;padding:32px;font-family:Georgia,serif;color:#E2E2E2;">
    <p style="letter-spacing:4px;color:#C9A24A;font-size:13px;">EXMORTIS</p>
    <h1 style="font-size:26px;letter-spacing:1px;">Odtwarzanie wstrzymane</h1>
    <p style="color:#8A8A8C;line-height:1.7;">Wstrzymałem odtwarzanie materiałów na Twoim koncie do <span style="color:#E2E2E2;">${do_}</span>.</p>
    <p style="color:#8A8A8C;line-height:1.7;">Powód: materiał był odtwarzany z kilku różnych sieci w krótkim czasie — przy dostępie imiennym traktuję to jako możliwe udostępnienie konta innej osobie.</p>
    <p style="color:#8A8A8C;line-height:1.7;">Jeśli to pomyłka (np. zmiana sieci w telefonie albo podróż), odpisz na ten list — zdejmę blokadę. Dostęp do zakupionych produktów zostaje na koncie, przedłużę go o czas wstrzymania.</p>
    <p style="margin:20px 0;"><a href="${APP_URL}/konto" style="color:#C9A24A;">Moje konto</a></p>
    <p style="color:#5C5C5E;font-size:12px;letter-spacing:2px;">WRACAM Z SIEBIE · UCZĘ WRACAĆ</p>
  </div>`,
      }).catch(() => {});
      return Response.json({ ok: true, until });
    }

    if (body.action === "unblock") {
      await sr.SecurityLog.update(String(body.log_id), { resolved: true });
      return Response.json({ ok: true });
    }

    if (body.action === "find") {
      const q = String(body.q || "").trim();
      const qu = q.toUpperCase();
      let lic = await sr.License.filter({ license_id: qu });
      if (!lic.length) lic = await sr.License.filter({ order_id: { $regex: `^${qu.replace(/[^A-Z0-9-]/g, "")}`, $options: "i" } });
      if (!lic.length && q.includes("@")) lic = await sr.License.filter({ user_email: q.toLowerCase() });
      // Wideo: identyfikator = ostatnie 8 znaków id dostępu
      let acc = [];
      if (!lic.length && /^[A-Z0-9]{8}$/.test(qu)) acc = (await accessFilter(base44, { id: { $regex: `${qu.toLowerCase()}$` } }).catch(() => []));
      const emails = [...new Set([...lic.map((l) => l.user_email), ...acc.map((a) => a.user_email), ...(q.includes("@") ? [q.toLowerCase()] : [])])].slice(0, 5);
      const people = [];
      for (const em of emails) {
        people.push({
          email: em,
          licenses: lic.filter((l) => l.user_email === em),
          access: await accessFilter(base44, { user_email: em }, "-created_date", 50),
          plays: await sr.PlaybackLog.filter({ user_email: em }, "-created_date", 20),
          pdfs: await sr.SecurityLog.filter({ user_email: em, type: "pdf" }, "-created_date", 20),
        });
      }
      return Response.json({ people });
    }

    if (body.action === "grant") {
      if (!email.includes("@")) return Response.json({ error: "Podaj e-mail" }, { status: 400 });
      const rows = await runSql(base44, `SELECT id, name, product_type, access_months FROM public.products WHERE id::text = ${escStr(String(body.product_id))} LIMIT 1`, true);
      if (!rows[0]) return Response.json({ error: "Nie ma takiego produktu" }, { status: 404 });
      // Pakiet: dostęp nadajemy jego składnikom.
      const items = await expandBundles(base44, rows);
      let until = null;
      for (const it of items) {
        const u = await grantAccess(base44, { email, product: it, source: "reczny" });
        if (u) until = u;
      }
      await ensureAccount(base44, email);
      return Response.json({ ok: true, valid_until: until });
    }

    const a = await accessGet(base44, String(body.access_id || "")).catch(() => null);
    if (!a) return Response.json({ error: "Nie ma takiego dostępu" }, { status: 404 });
    const hist = (x) => [...(a.history || []), { date: new Date().toISOString(), by: admin.email, ...x }];

    if (body.action === "extend") {
      const m = Math.max(1, Math.min(60, Number(body.months) || 1));
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
      const base = a.valid_until && a.valid_until >= today ? a.valid_until : today;
      const until = addMonths(base, m);
      await sr.Access.update(a.id, { valid_until: until, revoked: false, history: hist({ source: "przedluzenie", valid_until: until }) });
      await mirrorRecord(base44, "Access", a.id);
      return Response.json({ ok: true });
    }

    if (body.action === "revoke" || body.action === "restore") {
      const revoked = body.action === "revoke";
      await sr.Access.update(a.id, { revoked, history: hist({ source: revoked ? "odebrany" : "przywrocony" }) });
      await mirrorRecord(base44, "Access", a.id);
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