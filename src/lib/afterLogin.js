import { base44 } from "@/api/base44Client";
import { safeReturnTo } from "@/lib/authReturnTo";

const hasReturnTo = () => new URLSearchParams(window.location.search).has("returnTo");

// Cel po zalogowaniu: strona, z której przyszedł (także „/”); bez niej — /admin (admin) albo /konto (klient).
export async function afterLoginTarget() {
  if (hasReturnTo()) return safeReturnTo();
  const me = await base44.auth.me().catch(() => null);
  return me?.role === "admin" ? "/admin" : "/konto";
}

// Dla logowania Google — strona powrotu musi być znana przed przekierowaniem.
export function providerReturnTo() {
  return hasReturnTo() ? safeReturnTo() : "/konto";
}