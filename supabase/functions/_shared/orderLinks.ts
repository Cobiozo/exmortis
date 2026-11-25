// Zakup bez konta (decyzja właściciela 16.11.2026):
// - osobisty link do materiałów z zamówienia (/pobierz#t=…), ważny 7 dni; każde pobranie wydaje świeży,
//   krótko ważny link do pliku (PDF z osobistym znakiem wodnym — jak w koncie);
// - kursy i wideo tylko na koncie; konto zakłada się jednym kliknięciem „Aktywuj” (decyzja klienta, bez hasła);
// - po aktywacji konta przez kupującego: jednorazowy kod 20 zł (30 dni, od 49 zł, materiały cyfrowe);
// - jedno przypomnienie po 3 dniach, gdy nic nie pobrano i konta brak.
// Token w linku nie trafia do bazy — tylko jego skrót SHA-256.
import { runSql, escStr, serviceKey } from "./supabase.ts";
import { randomToken, sha256hex } from "./booking.ts";
import { expandBundles } from "./bundles.ts";
import { APP_URL } from "./settings.ts";
import { emailButton } from "./emailLayout.ts";
import { sendMail } from "./smtp.ts";

export const LINK_DAYS = 7;
export const ACTIVATE_DAYS = 30; // „Aktywuj konto” działa dłużej niż link do pobrania
export const FILE_TYPES = ["pdf", "audio"]; // do pobrania bez konta
export const ACCOUNT_TYPES = ["kurs", "wideo", "zestaw"]; // tylko na koncie (zestaw: ebook i nagrania bez linku do pobrania)
export const BUYER_CODE = { value: 20, days: 30, min: 49, typy: ["pdf", "audio", "wideo", "kurs", "zestaw", "pakiet"] };

// Adres projektu czytany przy wywołaniu (nie przy imporcie modułu).
const SUPA = () => ((globalThis as any).Deno?.env?.get("SUPABASE_URL") || "https://fqhvxhnbeyvwubpnuzxe.supabase.co").replace(/\/+$/, "");
const h = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

let ready = false;
export async function ensureLinks(base44) {
  if (ready) return;
  await runSql(base44, `CREATE TABLE IF NOT EXISTS public.order_links (
      token_hash text PRIMARY KEY, order_id text NOT NULL, email text NOT NULL, source text,
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
      downloads int NOT NULL DEFAULT 0, last_download_at timestamptz);
    CREATE INDEX IF NOT EXISTS order_links_order_idx ON public.order_links (order_id);
    CREATE INDEX IF NOT EXISTS order_links_email_idx ON public.order_links (lower(email));
    ALTER TABLE public.order_links ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.order_links FROM PUBLIC, anon, authenticated;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS access_reminder_at timestamptz`);
  ready = true;
}

// Nowy link do materiałów zamówienia. Zwraca surowy token (do maila / strony po zapłacie).
export async function createLink(base44, orderId: string, email: string, source: string) {
  await ensureLinks(base44);
  const token = randomToken();
  await runSql(base44, `INSERT INTO public.order_links (token_hash, order_id, email, source, expires_at)
    VALUES (${escStr(await sha256hex(token))}, ${escStr(orderId)}, ${escStr(String(email).toLowerCase())}, ${escStr(source)},
      now() + interval '${LINK_DAYS} days')`);
  return token;
}

export const linkUrl = (token: string) => `${APP_URL}/pobierz#t=${token}`;

// Link + zamówienie po tokenie. paid — tylko opłacone (COMPLETED); expired — po 7 dniach (aktywacja do 30 dni).
export async function linkByToken(base44, token: unknown) {
  const t = String(token || "");
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(t)) return null;
  await ensureLinks(base44);
  const [row] = await runSql(base44, `SELECT l.token_hash, l.order_id, l.email, l.expires_at, l.downloads,
      (l.expires_at < now()) AS expired, (l.created_at < now() - interval '${ACTIVATE_DAYS} days') AS too_old,
      o.status, o.items, o.buyer_name, o.created_date
    FROM public.order_links l JOIN public.orders o ON o.id::text = l.order_id
    WHERE l.token_hash = ${escStr(await sha256hex(t))} LIMIT 1`, true);
  if (!row) return null;
  return { ...row, paid: row.status === "COMPLETED" };
}

// Materiały cyfrowe zamówienia (pakiety rozwinięte na składniki).
export async function orderMaterials(base44, items) {
  const ids = (Array.isArray(items) ? items : []).map((i) => String(i?.product_id || "")).filter((x) => x && !x.startsWith("bilet:"));
  if (!ids.length) return [];
  const rows = await runSql(base44, `SELECT id::text AS id, name, product_type, access_months,
      (private_file_uri IS NOT NULL OR file_url IS NOT NULL) AS has_file
    FROM public.products WHERE id::text IN (${ids.map(escStr).join(",")})`, true);
  const all = await expandBundles(base44, rows);
  const seen = new Set();
  return all.filter((p) => [...FILE_TYPES, ...ACCOUNT_TYPES].includes(p.product_type) && !seen.has(String(p.id)) && seen.add(String(p.id)))
    .map((p) => ({ id: String(p.id), name: p.name, type: p.product_type, account_only: ACCOUNT_TYPES.includes(p.product_type), has_file: !!p.has_file }));
}

// ---- Konta (Supabase Auth, klucz service_role) ----
async function authAdmin(base44, path: string, init: RequestInit = {}) {
  const key = await serviceKey(base44);
  const res = await fetch(`${SUPA()}/auth/v1${path}`, {
    ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const d = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, d };
}

// Czy adres ma już konto (tabela kont aplikacji).
export async function hasAccount(base44, email: string) {
  const [r] = await runSql(base44, `SELECT 1 AS x FROM public.exm_user WHERE lower(data->>'email') = ${escStr(String(email).toLowerCase())}
     OR lower(email) = ${escStr(String(email).toLowerCase())} LIMIT 1`, true).catch(() => []);
  return !!r;
}

// Konto z linku z zamówienia: potwierdzony adres (link przyszedł na ten adres), profil i jednorazowy link logowania.
// 25.11.2026: z hasłem ustawionym przez kupującego na stronie /pobierz („Ustaw hasło i otwórz materiały”) —
// bez obejścia przez „Nie pamiętam hasła”. Bez hasła (stare linki) — jak dawniej, samo logowanie.
// Zwraca { created, token_hash } — token_hash wymienia przeglądarka na sesję (/auth/v1/verify, type magiclink).
export async function activateAccount(base44, email: string, name = "", password = "") {
  const mail = String(email).toLowerCase();
  let created = false;
  if (!(await hasAccount(base44, mail))) {
    const r = await authAdmin(base44, "/admin/users", { method: "POST", body: JSON.stringify({ email: mail, email_confirm: true, ...(password ? { password } : {}), user_metadata: name ? { full_name: name } : {} }) });
    // Hasło odrzucone przez zasady logowania (za słabe) — czytelny komunikat zamiast błędu.
    if (!r.ok && password && /password/i.test(JSON.stringify(r.d || {})) && !/already|exists|registered/i.test(JSON.stringify(r.d || {}))) {
      throw Object.assign(new Error("To hasło jest za słabe. Użyj co najmniej 8 znaków — najlepiej liter i cyfr."), { isValidation: true });
    }
    // 422 = konto w Auth już jest (np. bez profilu) — wtedy tylko logowanie.
    if (!r.ok && r.status !== 422) throw new Error(`Konto: ${r.status}`);
    created = r.ok;
    const now = new Date().toISOString();
    const full = String(name || mail.split("@")[0]).slice(0, 120);
    await runSql(base44, `INSERT INTO public.exm_user (email, role, data, created_date, updated_date)
      SELECT ${escStr(mail)}, 'user', ${escStr(JSON.stringify({ email: mail, full_name: full, role: "user", zrodlo: "zakup" }))}::jsonb, ${escStr(now)}, ${escStr(now)}
      WHERE NOT EXISTS (SELECT 1 FROM public.exm_user WHERE lower(data->>'email') = ${escStr(mail)} OR lower(email) = ${escStr(mail)})`).catch((e) => console.error("profil konta:", e?.message));
  }
  const g = await authAdmin(base44, "/admin/generate_link", { method: "POST", body: JSON.stringify({ type: "magiclink", email: mail }) });
  const tokenHash = g.d?.hashed_token || g.d?.properties?.hashed_token || "";
  if (!g.ok || !tokenHash) throw new Error(`Logowanie: ${g.status}`);
  // Konto w Auth było już wcześniej (bez profilu, 422) — hasło ustawiamy osobno.
  const uid = g.d?.id || g.d?.user?.id || "";
  if (password && !created && uid) {
    await authAdmin(base44, `/admin/users/${uid}`, { method: "PUT", body: JSON.stringify({ password }) }).catch((e) => console.error("hasło:", e?.message));
  }
  return { created, token_hash: tokenHash };
}

// ---- Kod 20 zł dla kupującego, który założył konto ----
function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "DZIEKI-" + [...b].map((x) => abc[x % abc.length]).join("");
}
const warsawDate = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(ms));
export const plDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

// Czy adres ma opłacone zamówienie (kwota > 0).
export async function hasPaidOrder(base44, email: string) {
  const [r] = await runSql(base44, `SELECT 1 AS x FROM public.orders WHERE lower(buyer_email) = ${escStr(String(email).toLowerCase())}
    AND status = 'COMPLETED' AND total > 0 LIMIT 1`, true).catch(() => []);
  return !!r;
}

// Jeden kod na osobę (wspólny znacznik „powitalny” z kodem dla nowego konta — kody się nie sumują i nie dublują).
export async function issueBuyerCode(base44, email: string, notify = true) {
  const mail = String(email).toLowerCase();
  const E = base44.asServiceRole.entities.DiscountCode;
  const has = await E.filter({ email: mail, powitalny: true }, "-created_date", 1).catch(() => null);
  if (!has || has.length) return null;
  const until = warsawDate(Date.now() + BUYER_CODE.days * 86400000);
  const code = newCode();
  await E.create({
    code, kind: "kwota", value: BUYER_CODE.value, valid_until: until, max_uses: 1, uses: 0, active: true,
    email: mail, powitalny: true, po_zakupie: true, typy: BUYER_CODE.typy, min_zl: BUYER_CODE.min, w_powiadomieniach: false,
    opis: `20 zł na kolejny materiał — dziękuję za zakup`,
  });
  if (notify) {
    const html = `<h1>Dziękuję, że jesteś</h1>
      <p>Twoje konto exmortis jest gotowe — zakupy, ROZDROŻA i Biblioteka są w jednym miejscu. Na kolejny materiał masz ode mnie 20 zł.</p>
      <p style="font-family:monospace;font-size:22px;letter-spacing:3px;color:#C9A24A;border:1px dashed #C9A24A;padding:12px 16px;display:inline-block">${code}</p>
      <p style="color:#A3A3A6;font-size:14px;">Kod jest jednorazowy, ważny do ${plDate(until)} włącznie i działa z adresem tego konta. Obejmuje e-booki, audio, kursy i pakiety przy zamówieniu od ${BUYER_CODE.min} zł (bez mentoringu, usług, biletów i kart podarunkowych). W jednym zamówieniu działa jeden kod.</p>
      ${emailButton("ZOBACZ SKARBIEC", `${APP_URL}/skarbiec`)}
      <p>Dawid</p>`;
    await sendMail(base44, { kind: "powitalny", ref: code, to: mail, subject: "EXMORTIS · 20 zł na kolejny materiał", html }).catch((e) => console.error("kod 20 zł — mail:", e?.message));
  }
  return { code, until };
}

// ---- Treść maila po zakupie (część o materiałach) ----
export function materialsEmailHtml({ materials, token, account, consent }) {
  if (!materials.length) return "";
  const files = materials.filter((m) => !m.account_only);
  const courses = materials.filter((m) => m.account_only);
  const list = (arr) => arr.map((m) => `<p style="margin:0 0 6px;color:#E8E6E1;">${h(m.name)}</p>`).join("");
  const url = linkUrl(token);
  let out = "";
  if (files.length) {
    out += `<h2>Twoje materiały</h2>${list(files)}
      ${emailButton(files.length > 1 ? "POBIERZ MATERIAŁY" : "POBIERZ", url)}
      <p style="color:#A3A3A6;font-size:14px;">Link jest osobisty i działa ${LINK_DAYS} dni. Gdy wygaśnie, na tej samej stronie poprosisz o nowy — przyjdzie na ten adres.</p>`;
  }
  if (courses.length) {
    // 25.11.2026: konto zakłada się ustawieniem hasła na stronie /pobierz (a=1 — od razu formularz hasła).
    const zestaw = courses.some((m) => m.type === "zestaw");
    out += `<h2>${zestaw ? "Twoje materiały na koncie" : courses.length > 1 ? "Kursy na Twoim koncie" : "Kurs na Twoim koncie"}</h2>${list(courses)}
      ${account ? emailButton("OTWÓRZ MOJE MATERIAŁY", `${APP_URL}/konto`) : `${emailButton("USTAW HASŁO I OTWÓRZ MATERIAŁY", `${url}&a=1`)}
      <p style="color:#A3A3A6;font-size:14px;">${zestaw ? "E-book i nagrania są na Twoim bezpłatnym koncie exmortis." : "Kurs oglądasz na bezpłatnym koncie exmortis."} Po kliknięciu ustawisz hasło — konto powstanie na ten adres i od razu otworzą się Twoje materiały.</p>`}`;
  }
  if (account) {
    out += `<p style="color:#A3A3A6;font-size:14px;">Zakup jest też na Twoim koncie: <a href="${APP_URL}/konto" style="color:#C9A24A;">Moje produkty</a>.</p>`;
  } else if (files.length) {
    out += `<div style="border:1px solid #2A2A2C;padding:20px 22px;margin:28px 0 8px;">
      <p style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#C9A24A;margin:0 0 10px;">BEZPŁATNE KONTO EXMORTIS</p>
      <p style="margin:0 0 10px;">Ustaw hasło i załóż konto na ten sam adres — zakup już tam czeka.</p>
      <p style="margin:0;color:#A3A3A6;font-size:14px;line-height:1.8;">· zakup na zawsze, bez szukania maili<br>· aktualizacje e-booka<br>· ROZDROŻA i Biblioteka<br>· 20 zł na kolejny materiał</p>
      ${emailButton("USTAW HASŁO I ZAŁÓŻ KONTO", `${url}&a=1`, { secondary: true })}
    </div>`;
  }
  if (consent) out += `<p style="color:#A3A3A6;font-size:13px;">Potwierdzam Twoje żądanie dostarczenia treści cyfrowych przed upływem 14 dni od zawarcia umowy oraz przyjęcie do wiadomości utraty prawa odstąpienia od umowy z chwilą rozpoczęcia dostarczania.</p>`;
  return out;
}

// ---- Nowy link mailem (wygasły link albo „nie mam linku”) ----
// Zawsze na adres z zamówienia. Do 3 ostatnich opłaconych zamówień z materiałami z ostatniego roku.
export async function resendLinks(base44, { email = "", orderId = "" }) {
  await ensureLinks(base44);
  const where = orderId ? `id::text = ${escStr(orderId)}` : `lower(buyer_email) = ${escStr(String(email).toLowerCase())}`;
  const orders = await runSql(base44, `SELECT id::text AS id, buyer_email, items, created_date FROM public.orders
    WHERE ${where} AND status = 'COMPLETED' AND created_date > now() - interval '365 days' ORDER BY created_date DESC LIMIT 3`, true);
  let sent = 0;
  for (const o of orders) {
    const materials = await orderMaterials(base44, o.items);
    if (!materials.length || !o.buyer_email) continue;
    const token = await createLink(base44, o.id, o.buyer_email, "ponownie");
    const account = await hasAccount(base44, o.buyer_email);
    const day = new Date(o.created_date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
    await sendMail(base44, {
      kind: "zamowienie_link", ref: o.id, to: o.buyer_email,
      subject: "EXMORTIS — nowy link do Twoich materiałów",
      html: `<h1>Nowy link do materiałów</h1><p>Zamówienie nr ${o.id.slice(0, 8).toUpperCase()} z ${day}.</p>` + materialsEmailHtml({ materials, token, account, consent: false }),
    });
    sent++;
  }
  return sent;
}

// ---- Przypomnienie po 3 dniach (zadanie cykliczne) ----
// Raz na zamówienie: brak konta i (nic nie pobrano albo jest kurs do aktywacji). Tylko zamówienia od 16.11.2026.
export async function accessReminders(base44, limit = 5) {
  await ensureLinks(base44);
  const rows = await runSql(base44, `SELECT o.id::text AS id, o.buyer_email, o.buyer_name, o.items,
      COALESCE((SELECT sum(downloads) FROM public.order_links l WHERE l.order_id = o.id::text), 0)::int AS downloads
    FROM public.orders o
    WHERE o.status = 'COMPLETED' AND o.access_reminder_at IS NULL AND o.buyer_email IS NOT NULL
      AND o.created_date < now() - interval '3 days' AND o.created_date > now() - interval '6 days'
      AND o.created_date > '2026-11-16T12:00:00Z'
      AND EXISTS (SELECT 1 FROM public.order_links l WHERE l.order_id = o.id::text)
    ORDER BY o.created_date LIMIT ${Number(limit) || 5}`, true);
  let n = 0;
  for (const o of rows) {
    await runSql(base44, `UPDATE public.orders SET access_reminder_at = now() WHERE id::text = ${escStr(o.id)} AND access_reminder_at IS NULL`);
    if (await hasAccount(base44, o.buyer_email)) continue;
    const materials = await orderMaterials(base44, o.items);
    const course = materials.some((m) => m.account_only);
    if (!materials.length || (o.downloads > 0 && !course)) continue;
    const token = await createLink(base44, o.id, o.buyer_email, "przypomnienie");
    const first = String(o.buyer_name || "").trim().split(/\s+/)[0];
    await sendMail(base44, {
      kind: "zamowienie_przypomnienie", ref: o.id, to: o.buyer_email,
      subject: course && !o.downloads ? "EXMORTIS — Twoje materiały czekają" : course ? "EXMORTIS — aktywuj dostęp do kursu" : "EXMORTIS — Twój e-book czeka",
      html: `<h1>${first ? `${h(first)}, T` : "T"}woje materiały czekają</h1><p>Kilka dni temu Twoje zamówienie w exmortis zostało opłacone${course ? "" : ", a nie widzę jeszcze pobrania"}. Tu jest świeży link — działa ${LINK_DAYS} dni.</p>`
        + materialsEmailHtml({ materials, token, account: false, consent: false }),
    }).catch((e) => console.error("przypomnienie — mail:", e?.message));
    n++;
  }
  return n;
}