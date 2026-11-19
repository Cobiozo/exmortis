// Logowanie na Supabase Auth — warstwa zastępująca base44.auth przy wyjściu z platformy
// (docs/tech/MIGRACJA.md, krok 8). To samo API co base44.auth, więc AuthContext i strony
// logowania nie wymagają zmian — przełącza jedna zmienna: VITE_EXM_AUTH_BACKEND=supabase.
// Profil (rola, imię) pochodzi z tabeli exm_user; sesja w pamięci przeglądarki.
// Przełączenie ma sens dopiero razem z przeniesieniem zapisów i hostingu.

import { SUPABASE_URL, ANON_KEY } from "./exmSupabase";

const KEY = "exm_supa_session";

const authUrl = () => `${SUPABASE_URL}/auth/v1`;
const restUrl = () => `${SUPABASE_URL}/rest/v1`;

const headers = (token) => ({
  apikey: ANON_KEY,
  Authorization: token ? `Bearer ${token}` : `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
});

// --- sesja ---
let cached = null;

const store = (s) => { cached = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* brak pamięci */ } };
const drop = () => { cached = null; try { localStorage.removeItem(KEY); } catch { /* brak pamięci */ } };

const load = () => {
  if (cached) return cached;
  try { cached = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { cached = null; }
  return cached;
};

// Link z maila Supabase (rejestracja, odzyskiwanie hasła) przynosi sesję w #hash — przenosimy do pamięci.
const fromHash = () => {
  if (!window.location.hash) return false;
  const h = new URLSearchParams(window.location.hash.slice(1));
  if (!h.get("access_token")) return false;
  store({
    access_token: h.get("access_token"),
    refresh_token: h.get("refresh_token"),
    expires_at: Math.floor(Date.now() / 1000) + (Number(h.get("expires_in")) || 3600),
  });
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
};

async function refreshSession() {
  const s = load();
  if (!s || !s.refresh_token) { drop(); return null; }
  try {
    const res = await fetch(`${authUrl()}/token?grant_type=refresh_token`, {
      method: "POST", headers: headers(), body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) { drop(); return null; }
    const d = await res.json();
    const fresh = {
      access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    };
    store(fresh);
    return fresh;
  } catch { return null; }
}

const expired = (s) => !s || !s.access_token || (s.expires_at || 0) - 60 < Math.floor(Date.now() / 1000);

async function session() {
  fromHash();
  let s = load();
  if (!s) return null;
  if (expired(s)) s = await refreshSession();
  return s;
}

// Aktualny token sesji (null dla gościa) — do wywołań funkcji i bramki.
export async function supaBearer() {
  const s = await session();
  return s ? s.access_token : null;
}

// --- profil (rola, imię) z tabeli kont ---
// Email i rola są w JSONB data, nie w osobnych kolumnach tabeli.
const profileQuery = (email) => `data->>email=eq.${encodeURIComponent(String(email || "").trim().toLowerCase())}`;

async function profile(s, supaUser) {
  const res = await fetch(`${restUrl()}/exm_user?${profileQuery(supaUser.email)}&select=data&limit=1`, {
    headers: headers(s.access_token),
  });
  if (!res.ok) {
    const error = new Error("Nie udało się odczytać uprawnień konta. Odśwież stronę i spróbuj ponownie.");
    error.status = res.status;
    throw error;
  }
  const row = (await res.json())?.[0]?.data;
  return {
    id: supaUser.id,
    email: supaUser.email,
    full_name: row?.full_name || supaUser.user_metadata?.full_name || "",
    role: row?.role || "user",
    created_date: supaUser.created_at,
    updated_date: supaUser.updated_at,
  };
}

const keep = (d) => ({
  access_token: d.access_token, refresh_token: d.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
});

async function api(path, init) {
  const res = await fetch(`${authUrl()}${path}`, init);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(d.error_description || d.msg || d.error || "Błąd logowania");
    e.status = res.status;
    throw e;
  }
  return d;
}

// --- weryfikacja dwuetapowa (TOTP) — audyt bezpieczeństwa 16.11.2026 ---
// Poziom sesji (aal1 = hasło/link, aal2 = potwierdzona kodem) z tokenu; czynniki z /user.
const aalOf = (token) => {
  try { return JSON.parse(atob(String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal || "aal1"; } catch { return "aal1"; }
};

export const supaMfa = {
  async state() {
    const s = await session();
    if (!s) return null;
    const u = await api("/user", { headers: headers(s.access_token) });
    const factors = (u.factors || []).filter((f) => f.factor_type === "totp");
    const verified = factors.filter((f) => f.status === "verified");
    return { aal: aalOf(s.access_token), verified, unverified: factors.filter((f) => f.status !== "verified") };
  },
  // Nowy czynnik TOTP: QR do zeskanowania w aplikacji (Google Authenticator, Microsoft Authenticator, 1Password…).
  async enroll() {
    const s = await session();
    if (!s) throw new Error("Brak sesji");
    const st = await this.state();
    for (const f of st.unverified) {
      await api(`/factors/${f.id}`, { method: "DELETE", headers: headers(s.access_token) }).catch(() => {});
    }
    const d = await api("/factors", { method: "POST", headers: headers(s.access_token),
      body: JSON.stringify({ factor_type: "totp", friendly_name: `exmortis ${new Date().toISOString().slice(0, 10)}` }) });
    return { id: d.id, qr: d.totp?.qr_code, uri: d.totp?.uri, secret: d.totp?.secret };
  },
  // Kod z aplikacji → sesja aal2 (zapisywana zamiast dotychczasowej).
  async verify(factorId, code) {
    const s = await session();
    if (!s) throw new Error("Brak sesji");
    const ch = await api(`/factors/${factorId}/challenge`, { method: "POST", headers: headers(s.access_token), body: "{}" });
    const d = await api(`/factors/${factorId}/verify`, { method: "POST", headers: headers(s.access_token),
      body: JSON.stringify({ challenge_id: ch.id, code: String(code).replace(/\s+/g, "") }) });
    if (!d.access_token) throw new Error("Kod nieprawidłowy");
    store(keep(d));
    return true;
  },
  // Wyłączenie wymaga sesji aal2 (Supabase).
  async remove(factorId) {
    const s = await session();
    if (!s) throw new Error("Brak sesji");
    await api(`/factors/${factorId}`, { method: "DELETE", headers: headers(s.access_token) });
    await refreshSession();
  },
};

// Maile konta (potwierdzenie, ponowny link, nowe hasło, powitanie) wysyła funkcja authMail w oprawie exmortis —
// nie domyślna poczta Supabase (po angielsku, z adresu supabase.io i tylko do członków zespołu projektu). 19.11.2026.
async function authMail(payload, token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/authMail`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token || ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(d.error || "Nie udało się wysłać wiadomości. Spróbuj za chwilę.");
    e.status = res.status;
    throw e;
  }
  return d;
}

export const supaAuth = {
  // Rejestracja nie loguje — konto czeka na kliknięcie linku z maila (/register?potwierdz=…).
  async register({ email, password, name, letters }) {
    try {
      sessionStorage.setItem("exm_pending_reg", JSON.stringify({ email, name, letters: !!letters, ts: Date.now() }));
    } catch { /* brak pamięci */ }
    await authMail({ action: "register", email, password, name, letters: !!letters, terms: true });
    return { email };
  },

  // Link z maila „Potwierdź adres” → sesja; dane z rejestracji (imię, zgoda na Listy) wracają z konta,
  // więc link działa także na innym urządzeniu niż to, na którym zakładano konto.
  async confirmSignup(tokenHash) {
    const d = await api("/verify", { method: "POST", headers: headers(), body: JSON.stringify({ type: "signup", token_hash: tokenHash }) });
    if (!d.access_token) throw new Error("Link wygasł albo został już użyty");
    store(keep(d));
    return { meta: d.user?.user_metadata || {}, email: d.user?.email || "" };
  },

  // Po potwierdzeniu: kod powitalny i mail z podziękowaniem od razu (zapasowo robi to też zadanie co 5 min).
  async welcome() {
    const s = await session();
    if (!s) return null;
    return await authMail({ action: "welcome" }, s.access_token).catch(() => null);
  },

  async verifyOtp({ email, otpCode }) {
    const d = await api("/verify", { method: "POST", headers: headers(), body: JSON.stringify({ type: "signup", email, token: otpCode }) });
    if (d.access_token) store(keep(d));
    return { access_token: d.access_token };
  },

  // Jednorazowy link logowania z aktywacji konta po zakupie (orderAccess → token_hash) → sesja.
  async loginWithTokenHash(tokenHash) {
    const d = await api("/verify", { method: "POST", headers: headers(), body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }) });
    if (!d.access_token) throw new Error("Nie udało się zalogować — spróbuj ponownie");
    store(keep(d));
    return { access_token: d.access_token };
  },

  async resendOtp(email) {
    await authMail({ action: "resend", email });
  },

  async setToken(accessToken) {
    if (accessToken && !load()) {
      store({ access_token: accessToken, refresh_token: null, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    }
  },

  async loginViaEmailPassword(email, password) {
    const d = await api("/token?grant_type=password", { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
    store(keep(d));
    return d.user ? await profile(keep(d), d.user) : null;
  },

  async loginWithProvider(provider, fromUrl) {
    try { if (fromUrl) sessionStorage.setItem("exm_auth_return", fromUrl); } catch { /* brak pamięci */ }
    // Google przez exmortis.pl (/functions/googleAuth): w oknie Google widać exmortis.pl, nie domenę Supabase.
    if (provider === "google") { window.location.href = "/functions/googleAuth?start=1"; return; }
    const p = provider === "microsoft" ? "azure" : provider;
    window.location.href = `${authUrl()}/authorize?provider=${encodeURIComponent(p)}&redirect_to=${encodeURIComponent(window.location.origin + "/login")}`;
  },

  async resetPasswordRequest(email) {
    await authMail({ action: "recover", email });
  },

  // Nowe hasło: link z maila exmortis (?odzysk= — token_hash), sesja z dawnego linku Supabase (#hash)
  // albo token recovery z zapytania.
  async resetPassword({ resetToken, tokenHash, newPassword }) {
    let s = null;
    if (tokenHash) {
      const d = await api("/verify", { method: "POST", headers: headers(), body: JSON.stringify({ type: "recovery", token_hash: tokenHash }) });
      if (!d.access_token) throw new Error("Link wygasł — zamów nowy");
      s = keep(d); store(s);
    }
    if (!s) s = await session();
    if (!s && resetToken) {
      const d = await api("/verify", { method: "POST", headers: headers(), body: JSON.stringify({ type: "recovery", token: resetToken }) });
      if (!d.access_token) throw new Error("Link wygasł — zamów nowy");
      s = keep(d); store(s);
    }
    if (!s) throw new Error("Link wygasł — zamów nowy");
    await api("/user", { method: "PUT", headers: headers(s.access_token), body: JSON.stringify({ password: newPassword }) });
  },

  async me() {
    if (!SUPABASE_URL || !ANON_KEY) throw new Error("Brak konfiguracji Supabase");
    const s = await session();
    if (!s) { const e = new Error("Brak sesji"); e.status = 401; throw e; }
    let u;
    try {
      u = await api("/user", { headers: headers(s.access_token) });
    } catch (e) {
      if (e.status === 401 || e.status === 403) { drop(); e.status = 401; }
      throw e;
    }
    return profile(s, u);
  },

  async updateMe(data) {
    const s = await session();
    if (!s) throw new Error("Brak sesji");
    // dane konta w Supabase Auth (imię itd.)
    await api("/user", { method: "PUT", headers: headers(s.access_token), body: JSON.stringify({ data }) });
    // profil aplikacyjny (rola, imię widoczne dla całej aplikacji)
    const u = await api("/user", { headers: headers(s.access_token) });
    const prof = await profile(s, u);
    const result = await fetch(`${restUrl()}/exm_user?${profileQuery(u.email)}`, {
      method: "PATCH",
      headers: headers(s.access_token),
      body: JSON.stringify({ data: { email: String(u.email || "").toLowerCase(), full_name: data.full_name ?? prof.full_name, role: prof.role } }),
    });
    if (!result.ok) throw new Error("Nie udało się zapisać profilu konta.");
    return { ...prof, ...data };
  },

  async logout(redirectUrl) {
    const s = load();
    if (s && s.access_token) {
      try { await api("/logout", { method: "POST", headers: headers(s.access_token), body: "{}" }); } catch { /* i tak czyścimy */ }
    }
    drop();
    window.location.href = redirectUrl || "/";
  },

  async isAuthenticated() {
    return Boolean(await session());
  },

  async redirectToLogin(nextUrl) {
    window.location.href = "/login" + (nextUrl ? `?returnTo=${encodeURIComponent(nextUrl)}` : "");
  },
};