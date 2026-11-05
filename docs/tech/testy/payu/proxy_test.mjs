// Test proxy server.js: /functions/payuNotification → Supabase. Sprawdza surowe body (bajt w bajt), nagłówek
// OpenPayu-Signature, dodanie klucza anon (verify_jwt) oraz zwrot statusu/treści odpowiedzi do PayU.
import http from "node:http";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
let got = null;
const up = http.createServer((req, res) => {
  const chunks = []; req.on("data", (c) => chunks.push(c));
  req.on("end", () => { got = { url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks) };
    res.writeHead(418, { "content-type": "application/json", "x-wewnetrzny": "nie-przekazywac" }); res.end('{"ok":false,"error":"RETRY"}'); });
}).listen(54321);
const srv = spawn("node", ["proxy/server.mjs"], { env: { ...process.env, PORT: "54322", VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_ANON_KEY: "ANON.TEST.KEY" }, stdio: ["ignore", "pipe", "pipe"] });
await new Promise((r) => setTimeout(r, 1500));
const body = Buffer.from(JSON.stringify({ order: { orderId: "ABC", status: "COMPLETED", totalAmount: "200", buyer: { firstName: "Zażółć" } } }) + "\n  ", "utf8");
const sig = "sender=checkout;signature=" + crypto.createHash("md5").update(body).digest("hex") + ";algorithm=MD5;content=DOCUMENT";
const res = await fetch("http://127.0.0.1:54322/functions/payuNotification?x=1", { method: "POST", headers: { "Content-Type": "application/json;charset=UTF-8", "OpenPayu-Signature": sig }, body });
const text = await res.text();
const checks = {
  "ścieżka do Supabase": got?.url === "/functions/v1/payuNotification?x=1",
  "metoda POST": got?.method === "POST",
  "surowe body bajt w bajt": got && Buffer.compare(got.body, body) === 0,
  "OpenPayu-Signature bez zmian": got?.headers["openpayu-signature"] === sig,
  "Content-Type bez zmian": got?.headers["content-type"] === "application/json;charset=UTF-8",
  "apikey = klucz anon": got?.headers["apikey"] === "ANON.TEST.KEY",
  "Authorization = Bearer anon": got?.headers["authorization"] === "Bearer ANON.TEST.KEY",
  "status odpowiedzi do PayU": res.status === 418,
  "treść odpowiedzi do PayU": text === '{"ok":false,"error":"RETRY"}',
  "nagłówek wewnętrzny nieprzekazany": !res.headers.get("x-wewnetrzny"),
};
let bad = 0; for (const [k, v] of Object.entries(checks)) { console.log((v ? "  OK   " : "  BŁĄD ") + k); if (!v) bad++; }
srv.kill(); up.close(); process.exit(bad ? 1 : 0);
