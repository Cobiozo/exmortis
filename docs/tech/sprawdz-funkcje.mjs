// Kontrola po wdrożeniu funkcji Edge (19.11.2026, po awarii kasy 13:11–13:50: BOOT_ERROR po złym spakowaniu).
// Wywołuje każdą funkcję z supabase/functions/* pustym zapytaniem i sprawdza, czy STARTUJE.
// Błąd walidacji („Brak pola…”, „Brak dostępu”, 4xx) = funkcja działa. BOOT_ERROR / „failed to start” / 5xx bez treści = alarm.
// Nic nie zapisuje (puste body nie przechodzi walidacji żadnej funkcji zapisującej).
// Użycie: node docs/tech/sprawdz-funkcje.mjs            — wszystkie funkcje
//         node docs/tech/sprawdz-funkcje.mjs payuCreateOrder subscribeNewsletter — wybrane
import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../supabase/functions");
const env = Object.fromEntries(
  (fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const URL_ = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) { console.error("Brak VITE_SUPABASE_URL / klucza publicznego w .env"); process.exit(2); }

// Funkcje, których nie wołamy (działają tylko z harmonogramu albo nie są wdrożone).
const SKIP = new Set(["_shared", "probePg"]);
const wanted = process.argv.slice(2);
const names = (wanted.length ? wanted : fs.readdirSync(root)).filter((n) => !SKIP.has(n) && fs.existsSync(path.join(root, n, "index.ts")));

let bad = 0;
for (const name of names) {
  let status = 0, text = "";
  try {
    const r = await fetch(`${URL_}/functions/v1/${name}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(20000),
    });
    status = r.status;
    text = (await r.text()).slice(0, 120);
  } catch (e) {
    text = "brak odpowiedzi: " + String(e?.message || e).slice(0, 80);
  }
  const boot = /BOOT_ERROR|failed to start|worker boot error/i.test(text);
  const down = boot || status === 0 || status === 502 || status === 503 || status === 504 || (status >= 500 && !text.trim());
  if (down) bad++;
  console.log(`${down ? "BŁĄD" : "ok  "} ${name.padEnd(26)} ${status} ${text.replace(/\s+/g, " ")}`);
}
console.log(bad ? `\n${bad} funkcji NIE działa — natychmiast wdrożyć ponownie standardową metodą (multipart, entrypoint supabase/functions/<nazwa>/index.ts).` : `\nWszystkie ${names.length} funkcje startują.`);
process.exit(bad ? 1 : 0);
