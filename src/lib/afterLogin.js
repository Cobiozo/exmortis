import { base44 } from "@/api/base44Client";
import { safeReturnTo } from "@/lib/authReturnTo";

// Podstrona jest celem powrotu tylko wtedy, gdy to konkretne miejsce (kasa, produkt, spotkanie, bilet…).
// Strona główna (także strona przerwy technicznej pod „/”), logowanie i rejestracja — nie: wtedy konto albo panel.
const usable = (to) => !!to && to.startsWith("/") && !to.startsWith("//") && !to.includes("\\")
  && to !== "/" && !to.startsWith("/?") && !to.startsWith("/#") && !to.startsWith("/login") && !to.startsWith("/register");

const pageReturnTo = () => {
  if (!new URLSearchParams(window.location.search).has("returnTo")) return null;
  const to = safeReturnTo();
  return usable(to) ? to : null;
};

const roleTarget = async () => {
  const me = await base44.auth.me().catch(() => null);
  return me?.role === "admin" ? "/admin" : "/konto";
};

// Cel po zalogowaniu: podstrona, z której przyszedł; bez niej — /admin (admin) albo /konto (klient).
export async function afterLoginTarget() {
  return pageReturnTo() || (await roleTarget());
}

// Dla logowania Google — strona powrotu musi być znana przed przekierowaniem (zapamiętuje ją exmAuth).
export function providerReturnTo() {
  return pageReturnTo() || "/konto";
}

// Strona logowania przy aktywnej sesji (powrót z Google z #access_token albo wejście już zalogowanego):
// od razu dalej — zapamiętana strona powrotu, ?returnTo= albo konto/panel. null = brak sesji.
export async function loggedInTarget() {
  if (!(await base44.auth.isAuthenticated().catch(() => false))) return null;
  let stored = null;
  try { stored = sessionStorage.getItem("exm_auth_return"); sessionStorage.removeItem("exm_auth_return"); } catch { /* brak pamięci */ }
  if (usable(stored) && stored !== "/konto") return stored;
  return pageReturnTo() || (await roleTarget());
}
