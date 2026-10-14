import fs from "fs"; import path from "path";
const OPIS = {
  adminContent: "Panel: treści stron (CMS) — lista, zapis, usuwanie bloków.",
  adminDashboard: "Pulpit panelu: liczniki (spotkania, zapisy, produkty, zamówienia, faktury) i baza kontaktów.",
  adminProducts: "Panel: produkty Skarbca (Supabase products) — lista z liczbą osób na liście oczekujących, zapis, usuwanie.",
  adminSubscribers: "Panel: subskrybenci newslettera.",
  adminSettings: "Panel: ustawienia strony (dane firmy, premiera, Zoom, ochrona filmów, PayU, dokumenty).",
  createPodcastApplication: "Publiczne zgłoszenie gościa podcastu (limit 3/h z IP).",
  createPowrotApplication: "Publiczny formularz kwalifikacyjny programu POWRÓT (limit 5/h z IP).",
  createContactMessage: "Publiczny formularz kontaktowy (pole-pułapka na boty).",
  payuNotification: "Powiadomienia PayU (webhook): weryfikacja podpisu, opłacenie zamówienia, nadanie dostępów, e-maile, pakiety sesji.",
  payuCreateOrder: "Kasa: wyliczenie ceny i rabatu na serwerze, utworzenie zamówienia w PayU, status po powrocie.",
  orderFree: "Zamówienie bezpłatnego materiału: zgody, dostęp, e-mail (limit 5/h z IP).",
};
const A = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const head = "> Plik generowany skryptem z kodu (docs/tech/generuj.mjs) — po zmianach uruchom ponownie: `node docs/tech/generuj.mjs`.\n\n";
// --- Encje Base44
const ents = fs.readdirSync(`${A}/base44/entities`).filter((f) => f.endsWith(".jsonc")).sort();
const used = (name) => { let n = 0; const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "node_modules") walk(p); } else if (/\.(jsx?|ts)$/.test(f) && fs.readFileSync(p, "utf8").includes(`.${name}.`)) n++; } }; walk(`${A}/src`); walk(`${A}/base44/functions`); walk(`${A}/base44/shared`); return n; };
let out = `# Dane w bazie Base44 (encje)\n\n${head}Każda encja to kolekcja dokumentów w bazie Base44 (pola systemowe: id, created_date, updated_date, created_by). RLS = kto może czytać/zapisywać z przeglądarki; funkcje serwera używają roli serwisowej (omijają RLS).\n\n| Encja | Pola | RLS odczyt / zapis | Plików używa |\n|---|---|---|---|\n`;
const rlsTxt = (r) => !r ? "domyślne (wszyscy)" : JSON.stringify(r).includes("admin") && !JSON.stringify(r.read || {}).length ? "admin" : r;
for (const f of ents) {
  const j = JSON.parse(strip(fs.readFileSync(`${A}/base44/entities/${f}`, "utf8")));
  const props = Object.entries(j.properties || {}).map(([k, v]) => `${k}${v.enum ? ` (${v.enum.slice(0, 6).join("/")}${v.enum.length > 6 ? "/…" : ""})` : v.type ? `:${v.type}` : ""}`);
  const r = j.rls || {};
  const show = (x) => x === undefined ? "–" : JSON.stringify(x) === "{}" ? "każdy" : JSON.stringify(x).includes('"role":"admin"') && !JSON.stringify(x).includes("$or") ? "admin" : "warunek";
  out += `| ${j.name} | ${props.join(", ")} | ${show(r.read)} / ${show(r.create)}·${show(r.update)}·${show(r.delete)} | ${used(j.name)} |\n`;
}
fs.writeFileSync(`${A}/docs/tech/DANE_BASE44.md`, out);
// --- Tabele Supabase (z kodu)
const sqlFiles = []; const walk2 = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk2(p); else if (/\.ts$/.test(f)) sqlFiles.push(p); } }; walk2(`${A}/base44`);
const tabs = new Map();
for (const p of sqlFiles) { const t = fs.readFileSync(p, "utf8"); for (const m of t.matchAll(/(FROM|INTO|UPDATE|JOIN|TABLE(?: IF NOT EXISTS)?|ON)\s+public\.([a-z_0-9]+)/gi)) { const n = m[2]; if (!tabs.has(n)) tabs.set(n, new Set()); tabs.get(n).add(p.replace(`${A}/`, "").replace("/entry.ts", "")); } }
const fnNames = new Set(); for (const p of sqlFiles) { const t = fs.readFileSync(p, "utf8"); for (const m of t.matchAll(/FUNCTION\s+public\.([a-z_0-9]+)/gi)) fnNames.add(m[1]); for (const m of t.matchAll(/rpc\([^,]+,\s*["']([a-z_0-9]+)/g)) fnNames.add(m[1]); }
let s = `# Dane w Supabase (projekt fqhvxhnbeyvwubpnuzxe)\n\n${head}Tabele i funkcje SQL wykryte w kodzie serwera. Dostęp: funkcje Base44 łączą się przez łącznik Supabase (Management API, \`runSql\`) albo przez PostgREST RPC z kluczem service_role pobieranym w locie (\`rpc\`) — patrz base44/shared/supabase.ts. Schematy tworzą/aktualizują pliki *Schema.ts / *Sql.ts.\n\n## Tabele\n\n| Tabela | Używana w |\n|---|---|\n`;
for (const [n, set] of [...tabs].sort()) if (!fnNames.has(n)) s += `| ${n} | ${[...set].sort().join(", ")} |\n`;
s += `\n## Funkcje SQL (RPC)\n\n${[...fnNames].sort().map((n) => `\`${n}\``).join(", ")}\n`;
fs.writeFileSync(`${A}/docs/tech/DANE_SUPABASE.md`, s);
// --- Funkcje serwera
const fns = fs.readdirSync(`${A}/base44/functions`).sort();
const srcAll = []; const walk3 = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk3(p); else if (/\.(jsx?)$/.test(f)) srcAll.push([p, fs.readFileSync(p, "utf8")]); } }; walk3(`${A}/src`);
const wf = fs.readdirSync(`${A}/base44/workflows`).map((f) => fs.readFileSync(`${A}/base44/workflows/${f}`, "utf8"));
let F = `# Funkcje serwera (Base44, Deno)\n\n${head}Adres: \`https://exmortis.pl/functions/<nazwa>\` (POST, JSON; z przeglądarki przez \`base44.functions.invoke\`). Kod: \`base44/functions/<nazwa>/entry.ts\`, wspólne moduły: \`base44/shared/\`.\n\n| Funkcja | Do czego | Dostęp | Akcje (body.action) | Wywoływana z |\n|---|---|---|---|---|\n`;
for (const n of fns) {
  const t = fs.readFileSync(`${A}/base44/functions/${n}/entry.ts`, "utf8");
  const cm = OPIS[n] || (t.match(/^\s*\/\/\s*(.+)$/m) || [])[1] || "";
  const acc = /requireAdmin|role !== "admin"|role === "admin"/.test(t) ? (/auth\.me\(\)/.test(t) && !/requireAdmin\(base44\);\s*$/m.test(t) ? "admin / zalogowany" : "admin") : /auth\.me\(\)|auth\.isAuthenticated/.test(t) ? "zalogowany" : /tick_token|TICK/.test(t) ? "publiczna + token zadań" : "publiczna";
  const acts = [...new Set([...t.matchAll(/(?:action|\ba)\s*===\s*"([a-z_0-9]+)"/g)].map((m) => m[1]))];
  const from = srcAll.filter(([, c]) => c.includes(`"${n}"`)).length + wf.filter((c) => c.includes(`"${n}"`)).length;
  const wfs = wf.filter((c) => c.includes(`"${n}"`)).length;
  F += `| ${n} | ${cm.replace(/\|/g, "/").slice(0, 140)} | ${acc} | ${acts.slice(0, 18).join(", ")}${acts.length > 18 ? ", …" : ""} | ${from - wfs} plików front${wfs ? `, ${wfs} zad. cykl.` : ""} |\n`;
}
fs.writeFileSync(`${A}/docs/tech/FUNKCJE.md`, F);
// --- Zadania cykliczne
let W = `# Zadania cykliczne (workflows Base44)\n\n${head}Pliki: \`base44/workflows/*.jsonc\`. Wywołują funkcje serwera z tokenem (\`tick_token\`) zapisanym w pliku — workflow Base44 nie czyta sekretów. Od 14.10.2026 całe tło obsługuje **jeden workflow „Zadania cykliczne”** (\`*/5 * * * *\`, czas polski → funkcja \`cronTick\`, która równolegle robi to samo, co dawniej sześć osobnych workflowów). Sześć starych plików jest **wyłączonych, nie usuniętych** — zostają jako wzorzec i historia. Po migracji: zwykły cron wołający te same adresy z tym samym tokenem.\n\n| Plik | Nazwa | Co robi | Harmonogram | Funkcja |\n|---|---|---|---|---|\n`;
for (const f of fs.readdirSync(`${A}/base44/workflows`).sort()) {
  const j = JSON.parse(strip(fs.readFileSync(`${A}/base44/workflows/${f}`, "utf8")));
  const txt = JSON.stringify(j);
  const sched = (txt.match(/"cron(?:_expression)?":"([^"]+)"/) || [])[1] || ((txt.match(/"interval[a-z_]*":(\d+)/) || [])[1] ? `co ${(txt.match(/"interval[a-z_]*":(\d+)/))[1]} ${(txt.match(/"interval_unit":"([a-z]+)"/) || [, "?"])[1]}` : "patrz plik");
  const fnsU = [...new Set([...txt.matchAll(/"function_name":"([a-zA-Z]+)"/g)].map((m) => m[1]))];
  W += `| ${f} | ${j.name || ""} | ${(j.description || "").replace(/tick_token[^ ,.]*/g, "").replace(/\|/g, "/").slice(0, 220)} | ${sched} | ${fnsU.join(", ")} |\n`;
}
fs.writeFileSync(`${A}/docs/tech/ZADANIA_CYKLICZNE.md`, W);
console.log("ok", ents.length, tabs.size, fns.length);