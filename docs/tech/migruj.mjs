// Przenosi funkcje serwerowe Base44 do Supabase Edge Functions (docs/tech/MIGRACJA.md, krok 6).
// Uruchomienie: node docs/tech/migruj.mjs  →  wypełnia supabase/functions/<nazwa>/index.ts
// Pliki _shared (compat.ts, shim.ts, supabase.ts) są w repo — skrypt ich nie nadpisuje.
import fs from "fs";
import path from "path";

const A = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const SRC_FN = `${A}/base44/functions`;
const SRC_SH = `${A}/base44/shared`;
const DST_FN = `${A}/supabase/functions`;

const NATIVE_SHARED = new Set(["compat.ts", "shim.ts", "supabase.ts"]);

// Zawijanie default export w Deno.serve + CORS (przeglądarka woła funkcje z exmortis.pl wprost).
const WRAP = `
// === Supabase Edge (wygenerowane przez docs/tech/migruj.mjs) ===
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const res = await handler(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg === "FORBIDDEN" ? 403 : e && e.isValidation ? 400 : 500;
    console.error("edge:", msg.slice(0, 300));
    return Response.json({ error: msg.slice(0, 300) }, { status, headers: CORS });
  }
});
`;

function rewriteSharedImports(t) {
  return t
    .replace(/from\s+["']base44:runtime["']/g, 'from "./shim.ts"');
}

function rewriteEntry(t) {
  return t
    .replace(/from\s+["']npm:@base44\/sdk@[0-9.]+["']/g, 'from "../_shared/compat.ts"')
    .replace(/from\s+["']base44:runtime["']/g, 'from "../_shared/shim.ts"')
    .replace(/from\s+["']\.\.\/\.\.\/shared\/([A-Za-z0-9_]+)\.ts["']/g, 'from "../_shared/$1.ts"')
    .replace(/export\s+default\s+(async\s+function\s*[A-Za-z0-9_$]*\s*\()/, "const handler = $1")
    .replace(/export\s+default\s+async\s*\(/, "const handler = async (");
}

let copied = 0, skipped = [], warnings = [];
for (const f of fs.readdirSync(SRC_SH).filter((x) => x.endsWith(".ts"))) {
  if (NATIVE_SHARED.has(f)) continue;
  fs.writeFileSync(`${DST_FN}/_shared/${f}`, rewriteSharedImports(fs.readFileSync(`${SRC_SH}/${f}`, "utf8")));
  copied++;
}

const names = fs.readdirSync(SRC_FN).sort();
for (const name of names) {
  const entry = `${SRC_FN}/${name}/entry.ts`;
  if (!fs.existsSync(entry)) continue;
  let t = rewriteEntry(fs.readFileSync(entry, "utf8"));
  if (!t.includes("const handler")) warnings.push(`${name}: nie znaleziono default export`);
  fs.mkdirSync(`${DST_FN}/${name}`, { recursive: true });
  fs.writeFileSync(`${DST_FN}/${name}/index.ts`, t + "\n" + WRAP);
  copied++;
}

// Ostrzeżenia: miejsca wymagające ręcznej decyzji po migracji.
const needAttention = [];
for (const name of names) {
  const f = `${DST_FN}/${name}/index.ts`;
  if (!fs.existsSync(f)) continue;
  const t = fs.readFileSync(f, "utf8");
  const tags = [];
  if (t.includes('getConnection("googlecalendar")')) tags.push("googlecalendar");
  if (t.includes('getConnection("instagram")')) tags.push("instagram");
  if (t.includes("aiGateway")) tags.push("aiGateway");
  if (tags.length) needAttention.push(`${name}: ${tags.join(", ")}`);
}
console.log(`Skopiowane pliki: ${copied}`);
if (warnings.length) console.log("UWAGI:\n" + warnings.join("\n"));
if (needAttention.length) console.log("Wymaga ręcznej decyzji (łączniki/gateway):\n" + needAttention.join("\n"));