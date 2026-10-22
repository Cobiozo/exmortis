import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireAdmin, emailField } from "../_shared/supabase.ts";
import { addSubscriber } from "../_shared/newsletter.ts";

// Dodawanie z panelu: domyślnie osoba dostaje prośbę o potwierdzenie (double opt-in — wymóg zgody na
// informację handlową i najlepsza ochrona przed spamem). Bez potwierdzenia tylko, gdy administrator
// oświadcza, że ma zgodę tej osoby (np. zapis na wydarzeniu) — źródło zapisujemy przy adresie.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
async function addFromPanel(base44, { email, name, groups, consent }) {
  await runSql(base44, `ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS source text`);
  const g = `${escStr(JSON.stringify(groups || []))}::jsonb`;
  if (consent) {
    await runSql(base44, `INSERT INTO public.subscribers (id, email, name, status, groups, source)
      VALUES (gen_random_uuid()::text, ${escStr(email)}, ${name ? escStr(name) : "NULL"}, 'active', ${g}, 'panel: zgoda potwierdzona przez administratora')
      ON CONFLICT (email) DO NOTHING`);
    return "active";
  }
  await addSubscriber(base44, { email, name });
  await runSql(base44, `UPDATE public.subscribers SET groups = ${g}, source = COALESCE(source, 'panel: prośba o potwierdzenie') WHERE email = ${escStr(email)}`);
  return "pending";
}

const STATUSES = ["active", "unsubscribed", "pending"];

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const subscribers = await runSql(
        base44,
        `SELECT id, email, name, status, groups, created_date, updated_date
         FROM public.subscribers
         ORDER BY created_date DESC
         LIMIT 1000`,
        true
      );
      return Response.json({ subscribers });
    }

    if (body.action === "save") {
      const email = emailField(body);
      const name = body.name === undefined || body.name === null || String(body.name).trim() === ""
        ? "NULL"
        : escStr(String(body.name).trim().slice(0, 200));
      const status = STATUSES.includes(body.status) ? body.status : "active";
      const groupsJson = JSON.stringify(
        Array.isArray(body.groups)
          ? body.groups.filter((g) => typeof g === "string").slice(0, 20).map((g) => g.slice(0, 100))
          : []
      );
      const groups = `${escStr(groupsJson)}::jsonb`;

      if (body.id) {
        await runSql(
          base44,
          `UPDATE public.subscribers SET email = ${escStr(email)}, name = ${name}, status = ${escStr(status)}, groups = ${groups}, updated_date = now()
           WHERE id = ${escStr(String(body.id))}`
        );
      } else {
        const st = await addFromPanel(base44, {
          email: email.toLowerCase(), name: name === "NULL" ? "" : String(body.name).trim().slice(0, 200),
          groups: JSON.parse(groupsJson), consent: body.consent === true,
        });
        return Response.json({ ok: true, status: st });
      }
      return Response.json({ ok: true });
    }

    // Wiele adresów naraz (wklejona lista: jeden na linię albo po przecinku; „Imię <adres>” też działa).
    if (body.action === "import") {
      const raw = String(body.text || "").slice(0, 50000);
      const groups = Array.isArray(body.groups) ? body.groups.filter((g) => typeof g === "string").slice(0, 20) : [];
      const seen = new Set();
      const items = [];
      for (const part of raw.split(/[\n,;]+/)) {
        const m = part.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
        const email = (m ? m[2] : part).trim().toLowerCase();
        if (!EMAIL_RE.test(email) || seen.has(email)) continue;
        seen.add(email);
        items.push({ email, name: m ? m[1].replace(/["']/g, "").trim().slice(0, 200) : "" });
      }
      if (items.length > 300) throw new Error("Najwyżej 300 adresów naraz.");
      let active = 0, pending = 0;
      for (const it of items) {
        const st = await addFromPanel(base44, { ...it, groups, consent: body.consent === true });
        if (st === "active") active++; else pending++;
      }
      return Response.json({ ok: true, total: items.length, active, pending });
    }

    if (body.action === "delete") {
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id subskrybenta");
      await runSql(base44, `DELETE FROM public.subscribers WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

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
