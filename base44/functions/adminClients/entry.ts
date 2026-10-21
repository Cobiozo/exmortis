import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";
import { grantAccess, isActive, ensureAccount } from "../../shared/access.ts";
import { mirrorRecord, accessFilter, accessGet } from "../../shared/mirror.ts";
import { expandBundles } from "../../shared/bundles.ts";
import { sendMail } from "../../shared/smtp.ts";
import { APP_URL } from "../../shared/settings.ts";

function addMonths(ymd: string, m: number) {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + m, d)).toISOString().slice(0, 10);
}

// Panel klientów: lista, szczegóły, ręczne nadanie / przedłużenie / odebranie dostępu.
export default async function (req) {
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