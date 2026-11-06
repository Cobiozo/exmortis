// TYMCZASOWA KONTROLA PŁATNOŚCI (tylko odczyt) — 6.11.2026, na polecenie właściciela. Potem funkcja wraca do 410.
// Autoryzacja: nagłówek X-Exm-Deploy — jednorazowy klucz; w kodzie tylko skrót SHA-256. Bez danych osobowych w odpowiedziach.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql } from "../../shared/supabase.ts";

const KEY_SHA = "471932f7e596ed88d8cbae97593345369d7a1ad4baccd4f93b871ac15a8e963e";
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const redact = (s: unknown) => String(s ?? "").replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[JWT]").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[e-mail]");

Deno.serve(async (req) => {
  const key = req.headers.get("x-exm-deploy") || "";
  if (!key || (await sha256(key)) !== KEY_SHA) return Response.json({ error: "Brak autoryzacji" }, { status: 401 });
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "sql_ro") return Response.json({ rows: await runSql(base44, String(body.q || ""), true) });
    if (body.action === "payu_peek") {
      const ids: string[] = (body.ids || []).map((x: string) => String(x).replace(/[^0-9a-f-]/gi, "")).filter(Boolean).slice(0, 8);
      const [p] = await runSql(base44, `SELECT value FROM public.app_settings WHERE key='payu'`, true);
      const payu = p?.value || {};
      const base = payu.env === "sandbox" ? "https://secure.snd.payu.com" : "https://secure.payu.com";
      const tr = await fetch(`${base}/pl/standard/user/oauth/authorize`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: String(payu.clientId || ""), client_secret: String(payu.clientSecret || "") }).toString() });
      const tok = (await tr.json().catch(() => ({})))?.access_token;
      const out: unknown[] = [{ oauth: tr.status, token: !!tok, env: payu.env || null, pos: /^\d+$/.test(String(payu.posId || "")), secondKey: String(payu.secondKey || "").length === 32 }];
      if (!tok) return Response.json({ wyniki: out });
      for (const id of ids) {
        const [o] = await runSql(base44, `SELECT id, payu_order_id FROM public.orders WHERE id LIKE '${id}%' LIMIT 1`, true);
        if (!o?.payu_order_id) { out.push({ id, blad: "brak" }); continue; }
        const g = await fetch(`${base}/api/v2_1/orders/${encodeURIComponent(o.payu_order_id)}`, { headers: { Authorization: `Bearer ${tok}` } });
        const po = ((await g.json().catch(() => ({}))) as any)?.orders?.[0] || {};
        out.push({ id: String(o.id).slice(0, 8), http: g.status, status: po.status, kwota: po.totalAmount, opis: po.description, notifyUrl: po.notifyUrl });
      }
      return Response.json({ wyniki: out });
    }
    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: redact((e as Error)?.message || e).slice(0, 400) }, { status: 500 });
  }
});
