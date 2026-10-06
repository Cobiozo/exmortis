import { base44 } from "@/api/base44Client";
import { safeReturnTo } from "@/lib/authReturnTo";

// Cel po zalogowaniu: strona, z której przyszedł, albo /admin (admin) / /konto (klient).
export async function afterLoginTarget() {
  const back = safeReturnTo();
  if (back && back !== "/") return back;
  const me = await base44.auth.me().catch(() => null);
  return me?.role === "admin" ? "/admin" : "/konto";
}

// Dla logowania Google — strona powrotu musi być znana przed przekierowaniem.
export function providerReturnTo() {
  const back = safeReturnTo();
  return back && back !== "/" ? back : "/konto";
}