import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { runSql, escStr, requireAdmin } from "../../shared/supabase.ts";
import { loadAppUrl } from "../../shared/settings.ts";
import { sendMail, campaignEmailHtml, requireMail } from "../../shared/smtp.ts";

// Moduł newslettera: grupy odbiorców, kampanie i wysyłki przez SMTP.
const SEND_BATCH = 10;

async function ensureTables(base44) {
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.subscribers (
      id text PRIMARY KEY,
      email text UNIQUE NOT NULL,
      name text,
      status text NOT NULL DEFAULT 'active',
      groups jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_date timestamptz DEFAULT now(),
      updated_date timestamptz DEFAULT now()
    )`
  );
  await runSql(
    base44,
    `ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS groups jsonb NOT NULL DEFAULT '[]'::jsonb`
  );
  // Klucz wypisu (link w mailu kampanii). Uzupełniany raz, także dla adresów zapisanych wcześniej.
  await runSql(base44, `ALTER TABLE public.subscribers ADD COLUMN IF NOT EXISTS unsub_token text`);
  await runSql(base44, `UPDATE public.subscribers SET unsub_token = replace(gen_random_uuid()::text, '-', '') WHERE unsub_token IS NULL`);
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.newsletter_groups (
      id text PRIMARY KEY,
      name text NOT NULL,
      created_date timestamptz DEFAULT now()
    )`
  );
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.campaigns (
      id text PRIMARY KEY,
      subject text NOT NULL,
      content text NOT NULL DEFAULT '',
      group_id text,
      status text NOT NULL DEFAULT 'draft',
      sent_count int NOT NULL DEFAULT 0,
      created_date timestamptz DEFAULT now(),
      sent_date timestamptz
    )`
  );
  await runSql(
    base44,
    `CREATE TABLE IF NOT EXISTS public.campaign_recipients (
      campaign_id text NOT NULL,
      subscriber_id text NOT NULL,
      email text NOT NULL,
      sent_date timestamptz DEFAULT now(),
      PRIMARY KEY (campaign_id, subscriber_id)
    )`
  );
}

// Ilu aktywnych odbiorców danej kampanii jeszcze nie dostało listu.
async function remainingFor(base44, campaign) {
  const groupFilter = campaign.group_id
    ? ` AND s.groups @> to_jsonb(${escStr(campaign.group_id)})`
    : "";
  const rows = await runSql(
    base44,
    `SELECT count(*) AS n FROM public.subscribers s
     WHERE s.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM public.campaign_recipients r
         WHERE r.campaign_id = ${escStr(campaign.id)} AND r.subscriber_id = s.id
       )${groupFilter}`,
    true
  );
  return rows.length ? Number(rows[0].n) : 0;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ===== GRUPY =====
    if (action === "groups.list") {
      await ensureTables(base44);
      const groups = await runSql(
        base44,
        `SELECT g.id, g.name, g.created_date,
          (SELECT count(*) FROM public.subscribers s
           WHERE s.status = 'active' AND s.groups @> to_jsonb(g.id)) AS members
         FROM public.newsletter_groups g ORDER BY g.name`,
        true
      );
      const total = await runSql(
        base44,
        `SELECT count(*) AS n FROM public.subscribers WHERE status = 'active'`,
        true
      );
      return Response.json({ groups, totalActive: total.length ? Number(total[0].n) : 0 });
    }

    if (action === "groups.save") {
      await ensureTables(base44);
      const name = String(body.name || "").trim().slice(0, 100);
      if (!name) throw new Error("Podaj nazwę grupy");
      if (body.id) {
        await runSql(
          base44,
          `UPDATE public.newsletter_groups SET name = ${escStr(name)} WHERE id = ${escStr(String(body.id))}`
        );
      } else {
        await runSql(
          base44,
          `INSERT INTO public.newsletter_groups (id, name) VALUES (gen_random_uuid()::text, ${escStr(name)})`
        );
      }
      return Response.json({ ok: true });
    }

    if (action === "groups.delete") {
      await ensureTables(base44);
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id grupy");
      await runSql(
        base44,
        `UPDATE public.subscribers
         SET groups = COALESCE((
           SELECT jsonb_agg(v) FROM jsonb_array_elements(groups) v WHERE v <> to_jsonb(${escStr(id)})
         ), '[]'::jsonb)
         WHERE groups @> to_jsonb(${escStr(id)})`
      );
      await runSql(base44, `UPDATE public.campaigns SET group_id = NULL WHERE group_id = ${escStr(id)}`);
      await runSql(base44, `DELETE FROM public.newsletter_groups WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true });
    }

    // ===== KAMPANIE =====
    if (action === "campaigns.list") {
      await ensureTables(base44);
      const campaigns = await runSql(
        base44,
        `SELECT c.id, c.subject, c.group_id, c.status, c.sent_count, c.created_date, c.sent_date,
          g.name AS group_name
         FROM public.campaigns c
         LEFT JOIN public.newsletter_groups g ON g.id = c.group_id
         ORDER BY c.created_date DESC LIMIT 200`,
        true
      );
      return Response.json({ campaigns });
    }

    if (action === "campaigns.get") {
      await ensureTables(base44);
      const id = String(body.id || "");
      const rows = await runSql(
        base44,
        `SELECT id, subject, content, group_id, status FROM public.campaigns WHERE id = ${escStr(id)}`,
        true
      );
      if (!rows.length) throw new Error("Nie znaleziono kampanii");
      const remaining = await remainingFor(base44, rows[0]);
      return Response.json({ campaign: rows[0], remaining });
    }

    if (action === "campaigns.save") {
      await ensureTables(base44);
      const subject = String(body.subject || "").trim().slice(0, 300);
      if (!subject) throw new Error("Podaj temat kampanii");
      const content = String(body.content || "").slice(0, 100000);
      const groupId = body.group_id ? escStr(String(body.group_id)) : "NULL";

      let id;
      if (body.id) {
        id = String(body.id);
        const cur = await runSql(
          base44,
          `SELECT status FROM public.campaigns WHERE id = ${escStr(id)}`,
          true
        );
        if (!cur.length) throw new Error("Nie znaleziono kampanii");
        if (cur[0].status === "sent") throw new Error("Kampania już wysłana — nie można jej edytować");
        await runSql(
          base44,
          `UPDATE public.campaigns
           SET subject = ${escStr(subject)}, content = ${escStr(content)}, group_id = ${groupId}
           WHERE id = ${escStr(id)}`
        );
      } else {
        id = crypto.randomUUID();
        await runSql(
          base44,
          `INSERT INTO public.campaigns (id, subject, content, group_id)
           VALUES (${escStr(id)}, ${escStr(subject)}, ${escStr(content)}, ${groupId})`
        );
      }
      const rows = await runSql(
        base44,
        `SELECT id, subject, content, group_id, status FROM public.campaigns WHERE id = ${escStr(id)}`,
        true
      );
      const remaining = await remainingFor(base44, rows[0]);
      return Response.json({ ok: true, id, remaining });
    }

    if (action === "campaigns.delete") {
      await ensureTables(base44);
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id kampanii");
      await runSql(base44, `DELETE FROM public.campaign_recipients WHERE campaign_id = ${escStr(id)}`);
      await runSql(base44, `DELETE FROM public.campaigns WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true });
    }

    // ===== WYSYŁKA (partie po SEND_BATCH — frontend pętli aż do done) =====
    if (action === "campaigns.send") {
      await ensureTables(base44);
      const id = String(body.id || "");
      const rows = await runSql(
        base44,
        `SELECT * FROM public.campaigns WHERE id = ${escStr(id)}`,
        true
      );
      if (!rows.length) throw new Error("Nie znaleziono kampanii");
      const campaign = rows[0];
      if (campaign.status === "sent") throw new Error("Kampania już została wysłana");
      if (!String(campaign.content || "").trim()) throw new Error("Kampania nie ma treści — zapisz szkic");

      const groupFilter = campaign.group_id
        ? ` AND s.groups @> to_jsonb(${escStr(campaign.group_id)})`
        : "";
      const batch = await runSql(
        base44,
        `SELECT s.id, s.email, s.name, s.unsub_token FROM public.subscribers s
         WHERE s.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM public.campaign_recipients r
             WHERE r.campaign_id = ${escStr(id)} AND r.subscriber_id = s.id
           )${groupFilter}
         ORDER BY s.created_date
         LIMIT ${SEND_BATCH}`,
        true
      );

      if (batch.length === 0) {
        await runSql(
          base44,
          `UPDATE public.campaigns SET status = 'sent', sent_date = now() WHERE id = ${escStr(id)}`
        );
        return Response.json({ done: true, sent: 0, remaining: 0, failures: [] });
      }

      await requireMail(base44);
      const appUrl = await loadAppUrl(base44);
      const sentRows = [];
      const failures = [];
      for (const s of batch) {
        try {
          await sendMail(base44, {
            kind: "listy", ref: id,
            to: s.email,
            subject: campaign.subject,
            html: campaignEmailHtml(String(campaign.content || ""), s.name || "",
              s.unsub_token ? `${appUrl}/listy/wypis?t=${s.unsub_token}` : ""),
            ...(s.unsub_token ? { headers: { "List-Unsubscribe": `<${appUrl}/listy/wypis?t=${s.unsub_token}>` } } : {}),
          });
          sentRows.push(s);
        } catch {
          failures.push(s.email);
        }
      }
      if (sentRows.length === 0) {
        throw new Error("Wysyłka nie powiodła się — sprawdź Ustawienia → Wysyłka e-mail");
      }
      const values = sentRows
        .map((s) => `(${escStr(id)}, ${escStr(String(s.id))}, ${escStr(s.email)})`)
        .join(",");
      await runSql(
        base44,
        `INSERT INTO public.campaign_recipients (campaign_id, subscriber_id, email)
         VALUES ${values} ON CONFLICT DO NOTHING`
      );
      await runSql(
        base44,
        `UPDATE public.campaigns SET sent_count = sent_count + ${sentRows.length} WHERE id = ${escStr(id)}`
      );

      const remaining = await remainingFor(base44, campaign);
      if (remaining <= 0) {
        await runSql(
          base44,
          `UPDATE public.campaigns SET status = 'sent', sent_date = now() WHERE id = ${escStr(id)}`
        );
      }
      return Response.json({
        done: remaining <= 0,
        sent: sentRows.length,
        remaining,
        failures,
      });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Brak dostępu" }, { status: 403 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}