import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin, emailField } from "../../shared/supabase.ts";

const STATUSES = ["active", "unsubscribed"];

export default async function (req) {
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
        await runSql(
          base44,
          `INSERT INTO public.subscribers (id, email, name, status, groups)
           VALUES (gen_random_uuid()::text, ${escStr(email)}, ${name}, ${escStr(status)}, ${groups})
           ON CONFLICT (email) DO NOTHING`
        );
      }
      return Response.json({ ok: true });
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