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

// --- profil (rola, imię) z tabeli kont ---
async function profile(s, supaUser) {
  let row = null;
  try {
    const res = await fetch(`${restUrl()}/exm_user?email=ilike.${encodeURIComponent(supaUser.email || "")}&select=data&limit=1`, {
      headers: headers(s.access_token),
    });
    row = (await res.json())?.[0]?.data;
  } catch { /* profil dogoni przy następnym odświeżeniu */ }
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

export const supaAuth = {
  // Rejestracja nie loguje — konto czeka na potwierdzenie z maila (jak na platformie).
  async register({ email, password }) {
    await api("/signup", { method: "POST", headers: headers(), body: JSON.stringify({ email, password }) });
    return { email };
  },

  async verifyOtp({ email, otpCode }) {
    const d = await api("/verify", { method: "POST", headers: headers(), body: JSON.stringify({ type: "signup", email, token: otpCode }) });
    if (d.access_token) store(keep(d));
    return { access_token: d.access_token };
  },

  async resendOtp(email) {
    await api("/resend", { method: "POST", headers: headers(), body: JSON.stringify({ type: "signup", email }) });
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
    const p = provider === "microsoft" ? "azure" : provider;
    window.location.href = `${authUrl()}/authorize?provider=${encodeURIComponent(p)}&redirect_to=${encodeURIComponent(window.location.origin + "/login")}`;
  },

  async resetPasswordRequest(email) {
    await api("/recover", {
      method: "POST", headers: headers(),
      body: JSON.stringify({ email, redirect_to: window.location.origin + "/reset-password" }),
    });
  },

  // Nowe hasło: sesja z linku resetującego (#hash) albo token recovery z zapytania.
  async resetPassword({ resetToken, newPassword }) {
    let s = await session();
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
    await fetch(`${restUrl()}/exm_user?email=eq.${encodeURIComponent(String(u.email || "").toLowerCase())}`, {
      method: "PATCH",
      headers: headers(s.access_token),
      body: JSON.stringify({ data: { email: String(u.email || "").toLowerCase(), full_name: data.full_name ?? prof.full_name, role: prof.role } }),
    });
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