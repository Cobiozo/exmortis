import { createClientFromRequest } from "../_shared/compat.ts";
import { requireStaff, requireAdmin, emailField } from "../_shared/supabase.ts";
import { getSetting, saveSetting } from "../_shared/settings.ts";
import { smtpSend, mailReady, resetMailConfig, flushMailQueue } from "../_shared/smtp.ts";
import { onboardingOn, setOnboarding, onboardingMail } from "../_shared/onboarding.ts";
import { emailLayout } from "../_shared/emailLayout.ts";
import { followupOn, setFollowup, followupMail } from "../_shared/followup.ts";

// Ustawienia → Wysyłka e-mail: konfiguracja SMTP, test, status, kolejka zaległych, dziennik, DNS.
// Hasło zapisywane wyłącznie po stronie serwera (Supabase app_settings, RLS) — nigdy nie wraca do przeglądarki.

const MASK = "••••••••";
const KEYS = ["host", "port", "user", "password", "from", "from_name", "reply_to"];
const mask = (e) => { const [u, d] = String(e || "").split("@"); return d ? `${u.slice(0, 2)}***@${d}` : "***"; };

async function txt(name) {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`).then((x) => x.json()).catch(() => null);
  return (r?.Answer || []).map((a) => String(a.data || "").replace(/"\s*"/g, "").replace(/"/g, ""));
}
async function dnsCheck(domain) {
  if (!domain) return null;
  const [root, dmarc] = await Promise.all([txt(domain), txt(`_dmarc.${domain}`)]);
  const sels = ["simplycom1", "simplycom2", "default", "dkim", "mail", "google", "selector1", "selector2", "k1", "s1", "s2", "smtp", "resend", "brevo1", "mailjet", "pm", "zoho", "x"];
  const dk = await Promise.all(sels.map(async (s) => ((await txt(`${s}._domainkey.${domain}`)).some((t) => /v=DKIM1|k=rsa|p=/.test(t)) ? s : null)));
  return {
    domain,
    spf: root.find((t) => t.startsWith("v=spf1")) || null,
    dmarc: dmarc.find((t) => t.startsWith("v=DMARC1")) || null,
    dkim: dk.filter(Boolean),
  };
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await requireStaff(base44);
    // Rola „techniczna" widzi stan wysyłki, ale nie zmienia konfiguracji poczty
    // ani nie wysyła nią na dowolny adres — to ta sama dźwignia co klucze PayU.
    const tech = me.role !== "admin";
    const body = await req.json().catch(() => ({}));
    const Q = base44.asServiceRole.entities.MailQueue;
    // Dwa profile: „smtp” (konto, zamówienia, zapisy — skrzynka Simply) i „smtp_marketing” (Listy powrotu,
    // ogłoszenia — np. Brevo). Wysyłki masowej nie wolno puszczać przez zwykłą skrzynkę pocztową.
    const KEY = body.profile === "marketing" ? "smtp_marketing" : "smtp";
    const smtp = (await getSetting(base44, KEY)) || {};

    if (body.action === "status") {
      const queued = await Q.filter({ status: "kolejka" }, "created_date", 1000);
      const byKind = {};
      for (const m of queued) byKind[m.kind] = (byKind[m.kind] || 0) + 1;
      const cfg = {};
      for (const k of KEYS) cfg[k] = k === "password" ? (smtp.password ? MASK : "") : smtp[k] || "";
      return Response.json({ ready: mailReady(smtp), tested_at: smtp.tested_at || null, config: cfg, queue: { total: queued.length, byKind } });
    }

    if (body.action === "save") {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      const d = body.data || {};
      const next = { ...smtp };
      for (const k of KEYS) {
        const v = String(d[k] ?? "").trim().slice(0, 300);
        if (k === "password" && (v === "" || v === MASK)) continue;
        next[k] = v;
      }
      if (!next.port) next.port = "587";
      if (!next.from_name) next.from_name = "exmortis";
      next.status = "nieskonfigurowana"; // każda zmiana wymaga ponownego udanego testu
      delete next.tested_at;
      await saveSetting(base44, KEY, next);
      resetMailConfig();
      return Response.json({ ok: true });
    }

    if (body.action === "test") {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      const to = emailField(body, "to");
      try {
        await smtpSend(smtp, { to, subject: `exmortis: test wysyłki e-mail${KEY === "smtp_marketing" ? " (newsletter)" : ""}`, html: "<h1>Wysyłka działa</h1><p>To test z panelu exmortis. Jeśli widzisz tę wiadomość w skrzynce odbiorczej (nie w spamie), konfiguracja jest poprawna.</p>" });
      } catch (e) {
        await saveSetting(base44, KEY, { ...smtp, status: "nieskonfigurowana" });
        resetMailConfig();
        await Q.create({ to_email: to, subject: "test", kind: "test", status: "blad", blad: String(e?.message || e).slice(0, 500) });
        return Response.json({ ok: false, error: String(e?.message || e) });
      }
      await saveSetting(base44, KEY, { ...smtp, status: "dziala", tested_at: new Date().toISOString() });
      resetMailConfig();
      await Q.create({ to_email: to, subject: "test", kind: "test", status: "wyslany", sent_at: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (body.action === "dns") {
      const addr = String(smtp.from || "").match(/@([^\s>]+)/);
      return Response.json({ dns: await dnsCheck(addr ? addr[1].toLowerCase() : null) });
    }

    if (body.action === "log") {
      const rows = await Q.filter({}, "-created_date", 100);
      return Response.json({
        log: rows.map((m) => ({ id: m.id, to: mask(m.to_email), kind: m.kind, at: m.sent_at || m.created_date, status: m.status, blad: m.blad || null })),
      });
    }

    // Listy prowadzące po zakupie: przełącznik i podgląd każdego z czterech listów.
    if (body.action === "onboarding") {
      if (typeof body.wlaczone === "boolean") {
        if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
        await setOnboarding(base44, body.wlaczone);
      }
      return Response.json({ wlaczone: await onboardingOn(base44) });
    }
    if (body.action === "followup") {
      if (typeof body.wlaczone === "boolean") {
        if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
        await setFollowup(base44, body.wlaczone);
      }
      return Response.json({ wlaczone: await followupOn(base44) });
    }
    if (body.action === "followup_preview") {
      const variant = body.variant === "nieobecny" ? "nieobecny" : "obecny";
      const firma = await getSetting(base44, "firma").catch(() => null);
      const m = followupMail(variant, { name: "Anna", title: "Ze śmierci — o powrotach, o których świat nie mówi", site: "https://exmortis.pl",
        next: { title: "Wieczór powrotu", slug: "wieczor-powrotu", start_datetime: "2026-12-03T18:00:00Z" } });
      return Response.json({ subject: m.subject, html: emailLayout(m.html, { firma, kind: `po_spotkaniu_${variant}` }) });
    }
    if (body.action === "onboarding_preview") {
      const step = [1, 3, 7, 14].includes(Number(body.step)) ? Number(body.step) : 1;
      const type = ["pdf", "audio", "kurs", "pakiet"].includes(body.type) ? body.type : "pdf";
      const firma = await getSetting(base44, "firma").catch(() => null);
      const m = onboardingMail(step, { name: "Anna", product: type === "kurs" ? "Kurs: Cztery etapy powrotu" : type === "audio" ? "Wracam inny — audiobook" : "Wracam inny",
        type, site: "https://exmortis.pl", next: step === 14 ? { name: "Rozmowa na progu", slug: "rozmowa-na-progu", text: "Jedna sesja, jedna decyzja, pełna uwaga." } : null,
        optoutUrl: "https://exmortis.pl/listy/wypis?d=podglad" });
      return Response.json({ subject: m.subject, html: emailLayout(m.html, { firma, kind: `prowadzenie_${step}` }) });
    }

    if (body.action === "flush") {
      await requireAdmin(base44);
      return Response.json(await flushMailQueue(base44));
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
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
