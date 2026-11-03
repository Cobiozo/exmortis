import { createClientFromRequest } from "../_shared/compat.ts";
import { runSql, escStr, requireAdmin } from "../_shared/supabase.ts";
import { loadAppUrl, getSetting } from "../_shared/settings.ts";
import { emailLayout } from "../_shared/emailLayout.ts";
import { sendMail, campaignEmailHtml, requireMail, adminTo } from "../_shared/smtp.ts";
import { safeEqual } from "../_shared/libraryAccess.ts";

// Moduł newslettera: grupy odbiorców, kampanie i wysyłki przez SMTP.
// Statusy kampanii: draft (szkic) → scheduled (zaplanowana) → sending (wysyła się w tle) → sent.
const SEND_BATCH = 10;
const TICK_MS = 60000; // zaplanowana wysyłka w jednym przebiegu zadań cyklicznych (co 5 min) — najwyżej minuta

const escHtml = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plWhen = (iso) => new Date(iso).toLocaleString("pl-PL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });

// Jedna partia wysyłki kampanii (wspólna dla przycisku „Wyślij” i wysyłki zaplanowanej).
async function sendBatch(base44, campaign, appUrl) {
  const id = String(campaign.id);
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
    await runSql(base44, `UPDATE public.campaigns SET status = 'sent', sent_date = now() WHERE id = ${escStr(id)}`);
    return { done: true, sent: 0, remaining: 0, failures: [] };
  }
  const sentRows = [];
  const failures = [];
  for (const s of batch) {
    try {
      await sendMail(base44, {
        kind: "listy", ref: id,
        to: s.email,
        subject: campaign.subject,
        html: campaignEmailHtml(String(campaign.content || ""), s.name || "",
          s.unsub_token ? `${appUrl}/listy/wypis?t=${s.unsub_token}` : "",
          { cta_label: campaign.cta_label || "", cta_url: campaign.cta_url || "", buttons: campaign.buttons || null }),
        preheader: campaign.preheader || "",
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
  await runSql(base44, `UPDATE public.campaigns SET sent_count = sent_count + ${sentRows.length} WHERE id = ${escStr(id)}`);
  const remaining = await remainingFor(base44, campaign);
  if (remaining <= 0) {
    await runSql(base44, `UPDATE public.campaigns SET status = 'sent', sent_date = now() WHERE id = ${escStr(id)}`);
  }
  return { done: remaining <= 0, sent: sentRows.length, remaining, failures };
}

// Zadanie cykliczne: zaplanowane listy, których termin minął. Najpierw SELECT, potem zwykły UPDATE
// (exm_exec_sql gubi wynik UPDATE … RETURNING). Po zakończeniu — krótki mail do administratora.
async function scheduledTick(base44) {
  const t0 = Date.now();
  await ensureTables(base44);
  const due = await runSql(base44, `SELECT id FROM public.campaigns WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now() ORDER BY scheduled_at LIMIT 5`, true).catch(() => []);
  if (due?.length) {
    const ids = due.map((r) => escStr(String(r.id))).join(",");
    await runSql(base44, `UPDATE public.campaigns SET status = 'sending' WHERE id IN (${ids}) AND status = 'scheduled'`);
  }
  const active = await runSql(base44, `SELECT * FROM public.campaigns WHERE status = 'sending' ORDER BY scheduled_at NULLS LAST LIMIT 5`, true).catch(() => []);
  if (!active?.length) return { kampanie: 0 };
  const appUrl = await loadAppUrl(base44);
  const report = [];
  for (const c of active) {
    let sent = 0, done = false, error = "";
    try {
      while (Date.now() - t0 < TICK_MS) {
        const r = await sendBatch(base44, c, appUrl);
        sent += r.sent;
        if (r.done) { done = true; break; }
      }
    } catch (e) {
      error = String(e?.message || e).slice(0, 200);
    }
    report.push({ id: c.id, wyslane: sent, koniec: done, ...(error ? { blad: error } : {}) });
    if (done) {
      const to = await adminTo(base44).catch(() => null);
      const total = await runSql(base44, `SELECT sent_count FROM public.campaigns WHERE id = ${escStr(String(c.id))}`, true).catch(() => []);
      if (to) await sendMail(base44, { kind: "alarm", to, subject: `Wysłano zaplanowany list: ${String(c.subject).slice(0, 120)}`,
        html: `<p>Zaplanowany list „${escHtml(c.subject)}” wyszedł do ${Number(total?.[0]?.sent_count || 0)} odbiorców.</p><p>Jeśli część czeka na limit skrzynki (240 maili na 2 godziny), wyjdzie sama w kolejnych przebiegach.</p>` }).catch(() => {});
    }
    if (Date.now() - t0 >= TICK_MS) break;
  }
  return { kampanie: report };
}

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
  // Zajawka (preheader) i jeden przycisk akcji — profesjonalny list ma jeden jasny następny krok.
  await runSql(base44, `ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS preheader text, ADD COLUMN IF NOT EXISTS cta_label text, ADD COLUMN IF NOT EXISTS cta_url text`);
  // Planowana wysyłka (termin w UTC; panel pokazuje czas polski).
  await runSql(base44, `ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS scheduled_at timestamptz`);
  // Kilka przycisków w liście (do 3).
  await runSql(base44, `ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS buttons jsonb`);
}

// Adres przycisku: „exmortis.pl/test” → „https://exmortis.pl/test”; http:// → https://.
const fixUrl = (u) => {
  let v = String(u || "").trim().slice(0, 500);
  if (!v) return "";
  if (/^http:\/\//i.test(v)) v = "https://" + v.slice(7);
  if (!/^https:\/\//i.test(v)) {
    if (/^[a-z]+:/i.test(v)) throw new Error("Link przycisku musi być adresem strony (https://…)");
    v = "https://" + v.replace(/^\/+/, "");
  }
  return v;
};
// Do 3 przycisków: [{label, url}]. Zgodność wstecz: pojedyncze pola cta_label / cta_url.
const buttonsOf = (b) => {
  const raw = Array.isArray(b.buttons) ? b.buttons : [{ label: b.cta_label, url: b.cta_url }];
  const out = [];
  for (const x of raw.slice(0, 3)) {
    const label = String(x?.label || "").trim().slice(0, 60);
    const url = fixUrl(x?.url);
    if (!label && !url) continue;
    if (!label) throw new Error("Każdy przycisk z linkiem potrzebuje tekstu");
    if (!url) throw new Error(`Przycisk „${label}” nie ma linku`);
    out.push({ label, url });
  }
  return out;
};
const ctaOf = (b) => {
  const buttons = buttonsOf(b);
  return { cta_label: buttons[0]?.label || "", cta_url: buttons[0]?.url || "", buttons };
};

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

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // Zadanie cykliczne (cronTick) — dostęp tokenem zadania z mb_settings, nie sesją administratora.
    if (action === "campaigns.tick") {
      const rows = await runSql(base44, `SELECT tick_token FROM public.mb_settings WHERE id = 1`, true).catch(() => null);
      const stored = rows && rows[0] ? rows[0].tick_token : null;
      const given = typeof body.tick_token === "string" ? body.tick_token : "";
      if (!stored || !given || !safeEqual(given, stored)) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      return Response.json({ ok: true, ...(await scheduledTick(base44)) });
    }

    await requireAdmin(base44);

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
        `SELECT c.id, c.subject, c.group_id, c.status, c.sent_count, c.created_date, c.sent_date, c.scheduled_at,
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
        `SELECT id, subject, content, group_id, status, preheader, cta_label, cta_url, buttons, scheduled_at FROM public.campaigns WHERE id = ${escStr(id)}`,
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
      const preheader = String(body.preheader || "").trim().slice(0, 140);
      const { cta_label, cta_url, buttons } = ctaOf(body);
      const extra = `preheader = ${escStr(preheader)}, cta_label = ${escStr(cta_label)}, cta_url = ${escStr(cta_url)}, buttons = ${escStr(JSON.stringify(buttons))}::jsonb`;

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
        if (cur[0].status === "sending") throw new Error("Kampania właśnie się wysyła — nie można jej edytować");
        await runSql(
          base44,
          `UPDATE public.campaigns
           SET subject = ${escStr(subject)}, content = ${escStr(content)}, group_id = ${groupId}, ${extra}
           WHERE id = ${escStr(id)}`
        );
      } else {
        id = crypto.randomUUID();
        await runSql(
          base44,
          `INSERT INTO public.campaigns (id, subject, content, group_id)
           VALUES (${escStr(id)}, ${escStr(subject)}, ${escStr(content)}, ${groupId})`
        );
        await runSql(base44, `UPDATE public.campaigns SET ${extra} WHERE id = ${escStr(id)}`);
      }
      const rows = await runSql(
        base44,
        `SELECT id, subject, content, group_id, status, preheader, cta_label, cta_url, buttons FROM public.campaigns WHERE id = ${escStr(id)}`,
        true
      );
      const remaining = await remainingFor(base44, rows[0]);
      return Response.json({ ok: true, id, remaining });
    }

    // Podgląd dokładnie takiego listu, jaki dostanie odbiorca (oprawa, stopka, przycisk).
    if (action === "campaigns.preview") {
      await ensureTables(base44);
      const { cta_label, cta_url, buttons } = ctaOf(body);
      const appUrl = await loadAppUrl(base44);
      const firma = await getSetting(base44, "firma").catch(() => null);
      const html = emailLayout(campaignEmailHtml(String(body.content || ""), "Anna", "", { cta_label, cta_url, buttons }), {
        firma, kind: "listy", preheader: String(body.preheader || ""), unsubUrl: `${appUrl}/listy/wypis?t=podglad`,
        appUrl,
      });
      return Response.json({ html });
    }

    // Wysyłka próbna na adres administratora (nie liczy się do kampanii).
    if (action === "campaigns.test") {
      await ensureTables(base44);
      await requireMail(base44);
      const me = await base44.auth.me();
      const subject = String(body.subject || "").trim().slice(0, 300) || "Bez tematu";
      const { cta_label, cta_url, buttons } = ctaOf(body);
      const appUrl = await loadAppUrl(base44);
      await sendMail(base44, {
        kind: "listy", to: me.email, subject: `[TEST] ${subject}`,
        html: campaignEmailHtml(String(body.content || ""), me.full_name ? String(me.full_name).split(" ")[0] : "", "", { cta_label, cta_url, buttons }),
        preheader: String(body.preheader || ""),
        headers: { "List-Unsubscribe": `<${appUrl}/listy/wypis?t=test>` },
      });
      return Response.json({ ok: true, to: me.email });
    }

    // Zaplanowanie wysyłki: termin co najmniej 5 minut naprzód, najwyżej 90 dni. Treść zostaje edytowalna do startu.
    if (action === "campaigns.schedule") {
      await ensureTables(base44);
      await requireMail(base44);
      const id = String(body.id || "");
      const at = new Date(String(body.at || ""));
      if (!id) throw new Error("Najpierw zapisz szkic kampanii");
      if (isNaN(at.getTime())) throw new Error("Podaj datę i godzinę wysyłki");
      if (at.getTime() < Date.now() + 5 * 60000) throw new Error("Termin musi być co najmniej 5 minut od teraz");
      if (at.getTime() > Date.now() + 90 * 86400000) throw new Error("Termin może być najwyżej 90 dni naprzód");
      const rows = await runSql(base44, `SELECT status, content FROM public.campaigns WHERE id = ${escStr(id)}`, true);
      if (!rows.length) throw new Error("Nie znaleziono kampanii");
      if (rows[0].status === "sent" || rows[0].status === "sending") throw new Error("Ta kampania jest już wysłana albo właśnie się wysyła");
      if (!String(rows[0].content || "").trim()) throw new Error("Kampania nie ma treści — zapisz szkic");
      await runSql(base44, `UPDATE public.campaigns SET status = 'scheduled', scheduled_at = ${escStr(at.toISOString())}::timestamptz WHERE id = ${escStr(id)}`);
      return Response.json({ ok: true, scheduled_at: at.toISOString(), kiedy: plWhen(at.toISOString()) });
    }

    if (action === "campaigns.unschedule") {
      await ensureTables(base44);
      const id = String(body.id || "");
      await runSql(base44, `UPDATE public.campaigns SET status = 'draft', scheduled_at = NULL WHERE id = ${escStr(id)} AND status = 'scheduled'`);
      const rows = await runSql(base44, `SELECT status FROM public.campaigns WHERE id = ${escStr(id)}`, true);
      if (rows?.[0]?.status !== "draft") throw new Error("Nie da się już anulować — wysyłka ruszyła");
      return Response.json({ ok: true });
    }

    if (action === "campaigns.delete") {
      await ensureTables(base44);
      const id = String(body.id || "");
      if (!id) throw new Error("Brak id kampanii");
      const st = await runSql(base44, `SELECT status FROM public.campaigns WHERE id = ${escStr(id)}`, true).catch(() => []);
      if (st?.[0]?.status === "sending") throw new Error("Kampania właśnie się wysyła — usuń ją po zakończeniu");
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
      if (campaign.status === "sending") throw new Error("Ta kampania wysyła się już w tle (zaplanowana) — nie wysyłaj jej drugi raz");
      if (!String(campaign.content || "").trim()) throw new Error("Kampania nie ma treści — zapisz szkic");
      await requireMail(base44);
      // Ręczne „Wyślij” na zaplanowanej kampanii: plan znika, wysyłka idzie teraz.
      if (campaign.status === "scheduled") {
        await runSql(base44, `UPDATE public.campaigns SET status = 'draft', scheduled_at = NULL WHERE id = ${escStr(id)}`);
      }
      const appUrl = await loadAppUrl(base44);
      return Response.json(await sendBatch(base44, campaign, appUrl));
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