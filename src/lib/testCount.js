// Anonimowy licznik ukończeń testu (decyzja właściciela 5.11.2026).
// Po pokazaniu wyniku strona wysyła WYŁĄCZNIE nazwę wyniku (np. „duchowa”) do funkcji bazy test_done,
// która dolicza +1 do sumy dnia. Bez odpowiedzi, etapu, konta, e-maila i adresu IP — zawsze kluczem
// anonimowym (także u zalogowanych), bez ciasteczek. Raz na kartę przeglądarki (flaga w sessionStorage).
import { SUPABASE_URL, ANON_KEY, hasSupabase } from "@/api/exmSupabase";
import { supaBearer } from "@/api/exmAuth";

export const RESULT_KEYS = ["mentalna", "duchowa", "zyciowa", "wiele", "zadna"];
const FLAG = "exm_test_policzony";

export function countCompletion(key) {
  if (!hasSupabase || !RESULT_KEYS.includes(key)) return;
  try {
    if (sessionStorage.getItem(FLAG)) return;
    sessionStorage.setItem(FLAG, "1");
  } catch {}
  fetch(`${SUPABASE_URL}/rest/v1/rpc/test_done`, {
    method: "POST",
    keepalive: true,
    credentials: "omit",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_result: key }),
  }).catch(() => {});
}

// Panel administratora: sumy dzienne [{ day: "2026-11-05", result: "duchowa", n: 3 }] z ostatnich 400 dni.
export async function testCounts() {
  const token = await supaBearer().catch(() => null);
  if (!token) throw new Error("Brak sesji");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/test_stats`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Statystyki testu: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

const DAY = 86400000;
// Suma ukończeń z ostatnich `days` dni (dzień dzisiejszy wliczony).
export function sumDays(rows, days) {
  const from = new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10);
  return rows.filter((r) => String(r.day) >= from).reduce((s, r) => s + (Number(r.n) || 0), 0);
}
