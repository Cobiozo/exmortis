import { createClientFromRequest } from "../_shared/compat.ts";
import { clientIp, emailField, serviceKey } from "../_shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../_shared/rateLimit.ts";
import { sendMail } from "../_shared/smtp.ts";
import { emailButton } from "../_shared/emailLayout.ts";
import { APP_URL, loadAppUrl } from "../_shared/settings.ts";
import { issueWelcomeFor, welcomeEnabled } from "../_shared/welcomeCode.ts";

// Maile konta w oprawie exmortis zamiast domyślnych maili Supabase (19.11.2026).
// Supabase Auth na wbudowanej poczcie wysyła po angielsku, z adresu supabase.io i tylko do członków zespołu projektu —
// klienci nie dostawali linku. Tu link tworzy Supabase (admin generate_link: bez wysyłki), a mail idzie naszym SMTP.
//   register — nowe konto (niepotwierdzone) + mail „Potwierdź adres”; istniejące potwierdzone → mail „Masz już konto”
//   resend   — nowy link potwierdzający dla niepotwierdzonego konta
//   recover  — link do ustawienia nowego hasła
//   welcome  — po potwierdzeniu (zalogowana sesja): od razu kod powitalny i mail z podziękowaniem
// Odpowiedzi nie zdradzają, czy adres ma konto. Link wymienia strona: /auth/v1/verify z token_hash.

const SUPA = () => ((globalThis as any).Deno?.env?.get("SUPABASE_URL") || "https://fqhvxhnbeyvwubpnuzxe.supabase.co").replace(/\/+$/, "");
const h = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const first = (n: unknown) => String(n || "").trim().split(/\s+/)[0].slice(0, 40);
const valid = (msg: string) => { const e = new Error(msg); (e as { isValidation?: boolean }).isValidation = true; return e; };

async function authAdmin(path: string, init: RequestInit = {}) {
  const key = await serviceKey();
  const res = await fetch(`${SUPA()}/auth/v1${path}`, {
    ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const d = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, d };
}
const sha256hex = async (t: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const tokenOf = (d: any) => String(d?.hashed_token || d?.properties?.hashed_token || "");
const userOf = (d: any) => (d?.user && d.user.id ? d.user : d?.id ? d : null);

// Limit na adres e-mail (skrót, nie sam adres) — chroni skrzynkę przed zasypaniem linkami.
async function mailAllowed(base44, email: string, type: string, max: number) {
  return await ipAllowed(base44, "m:" + (await sha256hex(email)).slice(0, 24), type, max, 3600000);
}

async function confirmMail(base44, email: string, name: string, token: string) {
  await loadAppUrl(base44).catch(() => {});
  const url = `${APP_URL}/register?potwierdz=${encodeURIComponent(token)}`;
  const gift = await welcomeEnabled(base44).catch(() => false);
  const html = `<h1>Dziękuję za założenie konta</h1>
    <p>${name ? `${h(first(name))}, z` : "Z"}ostało jedno kliknięcie: potwierdź, że ten adres należy do Ciebie. Dopiero wtedy konto zacznie działać.</p>
    ${emailButton("POTWIERDZAM ADRES", url)}
    ${gift ? `<p>Zaraz po potwierdzeniu wyślę Ci drugi e-mail z kodem rabatowym na pierwszy materiał ze Skarbca.</p>` : ""}
    <p style="color:#A3A3A6;font-size:14px;">Link jest jednorazowy i ważny przez ograniczony czas. Gdy wygaśnie, na stronie rejestracji wybierz „Wyślij ponownie”. Jeśli nikt nie zakładał konta na ten adres, zignoruj tę wiadomość — bez kliknięcia konto nie zostanie aktywowane.</p>
    <p>Dawid</p>`;
  await sendMail(base44, { kind: "konto_potwierdzenie", to: email, subject: "EXMORTIS · Potwierdź adres e-mail", html, preheader: "Jedno kliknięcie i Twoje konto exmortis jest gotowe." });
}

async function existsMail(base44, email: string) {
  await loadAppUrl(base44).catch(() => {});
  const html = `<h1>To konto już istnieje</h1>
    <p>Ktoś — najpewniej Ty — próbował założyć konto exmortis na ten adres. Konto na ten adres już jest, więc wystarczy się zalogować.</p>
    ${emailButton("ZALOGUJ SIĘ", `${APP_URL}/login`)}
    <p>Nie pamiętasz hasła? Ustawisz nowe w kilka chwil.</p>
    ${emailButton("USTAW NOWE HASŁO", `${APP_URL}/forgot-password`, { secondary: true })}
    <p style="color:#A3A3A6;font-size:14px;">Jeśli to nie Ty, zignoruj tę wiadomość — na koncie nic się nie zmieniło.</p>
    <p>Dawid</p>`;
  await sendMail(base44, { kind: "konto_istnieje", to: email, subject: "EXMORTIS · Masz już konto", html, preheader: "Na ten adres jest już konto exmortis — wystarczy się zalogować." });
}

async function recoverMail(base44, email: string, token: string) {
  await loadAppUrl(base44).catch(() => {});
  const url = `${APP_URL}/reset-password?odzysk=${encodeURIComponent(token)}`;
  const html = `<h1>Ustaw nowe hasło</h1>
    <p>Dostałem prośbę o zmianę hasła do konta exmortis na ten adres. Kliknij przycisk i wpisz nowe hasło.</p>
    ${emailButton("USTAW NOWE HASŁO", url)}
    <p style="color:#A3A3A6;font-size:14px;">Link jest jednorazowy i ważny przez ograniczony czas. Jeśli to nie Ty prosisz o zmianę, zignoruj tę wiadomość — hasło zostanie bez zmian.</p>
    <p>Dawid</p>`;
  await sendMail(base44, { kind: "konto_haslo", to: email, subject: "EXMORTIS · Ustaw nowe hasło", html, preheader: "Link do ustawienia nowego hasła do konta exmortis." });
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ip = clientIp(req);
    const action = String(body.action || "");

    if (action === "register") {
      const email = emailField(body);
      const password = String(body.password || "");
      const name = String(body.name || "").trim().slice(0, 80);
      if (password.length < 10 || password.length > 72) throw valid("Hasło musi mieć od 10 do 72 znaków.");
      if (!name) throw valid("Podaj imię.");
      if (body.terms !== true) throw valid("Zaakceptuj regulamin i politykę prywatności.");
      if (!(await ipAllowed(base44, ip, "rejestracja", 10, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
      if (!(await mailAllowed(base44, email, "rejestracja_mail", 4))) return Response.json({ ok: true });
      const data = { full_name: name, imie: name, letters: body.letters === true, terms_accepted_at: new Date().toISOString(), zrodlo: "rejestracja" };
      const redirect_to = `${await loadAppUrl(base44).catch(() => APP_URL)}/register`;
      const g = await authAdmin("/admin/generate_link", { method: "POST", body: JSON.stringify({ type: "signup", email, password, data, redirect_to }) });
      if (g.status === 422 && /exist|registered/i.test(JSON.stringify(g.d))) {
        await existsMail(base44, email).catch((e) => console.error("authMail istnieje:", e?.message));
        return Response.json({ ok: true });
      }
      if (!g.ok || !tokenOf(g.d)) {
        const msg = String(g.d?.msg || g.d?.error_description || g.d?.message || "");
        console.error("authMail register:", g.status, msg.slice(0, 200));
        if (g.status === 422 && /password/i.test(msg)) throw valid("To hasło jest zbyt słabe. Wybierz dłuższe albo mniej oczywiste.");
        throw new Error(`generate_link ${g.status}`);
      }
      // Ponowna rejestracja niepotwierdzonego konta: Supabase zostawia stare hasło — ustawiamy to wpisane teraz.
      const u = userOf(g.d);
      if (u?.id && u.created_at && Date.now() - Date.parse(u.created_at) > 60000) {
        await authAdmin(`/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password }) }).catch(() => null);
      }
      await confirmMail(base44, email, name, tokenOf(g.d));
      return Response.json({ ok: true });
    }

    if (action === "resend") {
      const email = emailField(body);
      if (!(await ipAllowed(base44, ip, "rejestracja_ponow", 10, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
      if (!(await mailAllowed(base44, email, "rejestracja_mail", 4))) return Response.json({ ok: true });
      // Bez hasła: dla niepotwierdzonego konta Supabase wystawia nowy link; brak konta lub konto potwierdzone → nic nie wysyłamy.
      const g = await authAdmin("/admin/generate_link", { method: "POST", body: JSON.stringify({ type: "signup", email }) });
      if (g.ok && tokenOf(g.d)) {
        const u = userOf(g.d);
        await confirmMail(base44, email, String(u?.user_metadata?.imie || u?.user_metadata?.full_name || ""), tokenOf(g.d));
      }
      return Response.json({ ok: true });
    }

    if (action === "recover") {
      const email = emailField(body);
      if (!(await ipAllowed(base44, ip, "haslo_reset", 10, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
      if (!(await mailAllowed(base44, email, "haslo_mail", 4))) return Response.json({ ok: true });
      const redirect_to = `${await loadAppUrl(base44).catch(() => APP_URL)}/reset-password`;
      const g = await authAdmin("/admin/generate_link", { method: "POST", body: JSON.stringify({ type: "recovery", email, redirect_to }) });
      if (g.ok && tokenOf(g.d)) await recoverMail(base44, email, tokenOf(g.d));
      else if (g.status !== 404) console.error("authMail recover:", g.status);
      return Response.json({ ok: true });
    }

    if (action === "welcome") {
      const me = await base44.auth.me().catch(() => null);
      if (!me?.id) return Response.json({ error: "Zaloguj się" }, { status: 401 });
      const r = await authAdmin(`/admin/users/${me.id}`);
      const issued = r.ok ? await issueWelcomeFor(base44, r.d) : false;
      return Response.json({ ok: true, issued });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.isValidation) return Response.json({ error: error.message }, { status: 400 });
    console.error("authMail:", String(error?.message || error).slice(0, 300));
    return Response.json({ error: "Nie udało się wysłać wiadomości. Spróbuj za chwilę albo napisz do mnie." }, { status: 500 });
  }
};

// === Supabase Edge ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const hd = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) hd.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: hd });
  } catch (e) {
    const msg = String(e?.message || e);
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: "Coś poszło nie tak." }, { status: 500, headers: CORS });
  }
});
