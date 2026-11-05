import { base44 } from "@/api/base44Client";
import { safeReturnTo } from "@/lib/authReturnTo";

// Strona powrotu z ?returnTo= — tylko konkretna podstrona (kasa, produkt, spotkanie, bilet…).
// Strona główna (także strona przerwy technicznej pod „/”) nie jest celem: wtedy jak bez returnTo.
const pageReturnTo = () => {
  if (!new URLSearchParams(window.location.search).has("returnTo")) return null;
  const to = safeReturnTo();
  return to === "/" || to.startsWith("/?") || to.startsWith("/login") || to.startsWith("/register") ? null : to;
};

// Cel po zalogowaniu: podstrona, z której przyszedł; bez niej — /admin (admin) albo /konto (klient).
export async function afterLoginTarget() {
  const back = pageReturnTo();
  if (back) return back;
  const me = await base44.auth.me().catch(() => null);
  return me?.role === "admin" ? "/admin" : "/konto";
}

// Dla logowania Google — strona powrotu musi być znana przed przekierowaniem.
export function providerReturnTo() {
  return pageReturnTo() || "/konto";
}
