import { createClientFromRequest } from "../_shared/compat.ts";
import { requireStaff } from "../_shared/supabase.ts";
import { getSetting, saveSetting, deleteSetting, cleanAppUrl, DEFAULT_APP_URL } from "../_shared/settings.ts";
import { cleanFirma, cleanPremiera, PREMIERA_DEFAULT } from "../_shared/firma.ts";
import { cleanAplikacja } from "../_shared/appOffline.ts";
import { cleanPomiar, validatePomiar, POMIAR_DEFAULT } from "../_shared/tracking.ts";
import { cleanFaktury, fakturyToken } from "../_shared/invoices.ts";
import { syncDocs, publicDocs } from "../_shared/legalDocs.ts";
import { VIDEO_SETTING, signServerVideo, newVideoKey, ttlHours } from "../_shared/videoSign.ts";

const MASK = "********";

const PAYU_KEYS = ["posId", "clientId", "clientSecret", "secondKey", "env"];
const SMTP_KEYS = ["host", "port", "user", "password", "from"];

function maskSecrets(obj, keys) {
  const out = { ...(obj || {}) };
  for (const k of keys) if (out[k]) out[k] = MASK;
  return out;
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await requireStaff(base44);
    const tech = me.role !== "admin";
    const body = await req.json().catch(() => ({}));

    if (body.action === "get") {
      const payu = await getSetting(base44, "payu");
      const smtp = await getSetting(base44, "smtp");
      const app = await getSetting(base44, "app");
      const firma = await getSetting(base44, "firma");
      const premiera = await getSetting(base44, "premiera");
      const pomiar = await getSetting(base44, "pomiar");
      const faktury = await getSetting(base44, "faktury");
      const aplikacja = await getSetting(base44, "aplikacja");
      return Response.json({
        aplikacja: cleanAplikacja(aplikacja),
        pomiar: { ...POMIAR_DEFAULT, ...cleanPomiar(pomiar) },
        // Token API faktur siedzi w sekretach aplikacji — panel dostaje tylko informację, czy jest ustawiony.
        faktury: { ...cleanFaktury(faktury), token_set: !!fakturyToken() },
        firma: cleanFirma(firma),
        dokumenty: publicDocs(await getSetting(base44, "dokumenty")),
        // Rola techniczna nie widzi listy adresów z dostępem przedpremierowym.
        premiera: { ...PREMIERA_DEFAULT, ...(premiera || {}), ...(tech ? { dostep: [], dostep_ukryty: true } : {}) },
        app: { url: app?.url || DEFAULT_APP_URL },
        payu: payu ? maskSecrets(payu, ["clientSecret", "secondKey"]) : {},
        smtp: smtp ? maskSecrets(smtp, ["password"]) : {},
      });
    }

    if (body.action === "save" && body.target === "firma") {
      await saveSetting(base44, "firma", cleanFirma(body.data));
      return Response.json({ ok: true });
    }

    if (body.action === "save" && body.target === "dokumenty") {
      const { value, created } = await syncDocs(base44, body.data, body.snapshots, me?.email || "admin");
      await saveSetting(base44, "dokumenty", value);
      return Response.json({ ok: true, dokumenty: value, created });
    }

    if (body.action === "save" && body.target === "premiera") {
      const data = tech ? { ...body.data, dostep: (await getSetting(base44, "premiera"))?.dostep || [] } : body.data;
      await saveSetting(base44, "premiera", cleanPremiera(data));
      return Response.json({ ok: true });
    }

    // Pomiar kieruje dane odwiedzających do zewnętrznego narzędzia — zmienia to wyłącznie administrator.
    if (body.action === "save" && body.target === "pomiar") {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      const value = validatePomiar(body.data);
      if (!value.pixel_id && !value.ga4_id) value.wlaczony = false;
      await saveSetting(base44, "pomiar", value);
      return Response.json({ ok: true });
    }

    // Faktury: w panelu zapisujemy tylko ustawienia wystawiania — token API jest sekretem aplikacji.
    if (body.action === "save" && body.target === "faktury") {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      await saveSetting(base44, "faktury", cleanFaktury(body.data));
      return Response.json({ ok: true });
    }

    if (body.action === "save" && body.target === "aplikacja") {
      await saveSetting(base44, "aplikacja", cleanAplikacja(body.data));
      return Response.json({ ok: true });
    }

    if (body.action === "save" && body.target === "app") {
      await saveSetting(base44, "app", { url: cleanAppUrl(body.data?.url) });
      return Response.json({ ok: true });
    }

    if (body.action === "save") {
      const target = body.target;
      if (target !== "payu" && target !== "smtp") {
        throw new Error("Nieznana integracja");
      }
      // Klucze płatności i poczty zmienia wyłącznie administrator. Przejęcie ich pozwoliłoby
      // przekierować płatności na własne konto PayU albo całą wychodzącą pocztę na własny serwer.
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      const keys = target === "payu" ? PAYU_KEYS : SMTP_KEYS;
      const prev = (await getSetting(base44, target)) || {};
      const data = body.data && typeof body.data === "object" ? body.data : {};
      const next = {};
      for (const k of keys) {
        const raw = data[k];
        const v = raw === undefined || raw === null ? "" : String(raw).trim();
        if (v === "" || v === MASK) {
          // puste pole lub maska → utrzymaj wcześniej zapisany sekret
          if (prev[k] !== undefined && prev[k] !== "") next[k] = prev[k];
        } else {
          next[k] = v.slice(0, 300);
        }
      }
      if (target === "payu") {
        if (!next.posId) throw new Error("Podaj POS ID");
        if (!next.clientId) throw new Error("Podaj Client ID");
        if (!next.clientSecret) throw new Error("Podaj Client Secret");
        if (!next.secondKey) throw new Error("Podaj drugi klucz");
        next.env = next.env === "sandbox" ? "sandbox" : "secure";
      } else {
        if (!next.host) throw new Error("Podaj adres serwera SMTP");
        if (!next.user) throw new Error("Podaj login SMTP");
        if (!next.password) throw new Error("Podaj hasło SMTP");
        if (!next.port) next.port = "587";
      }
      await saveSetting(base44, target, next);
      return Response.json({ ok: true });
    }

    // ---- Mój stały link Zoom (do wyboru przy spotkaniach i konsultacjach 1:1) ----
    // Link i hasło pokoju Zoom — tylko administrator (rola techniczna nie potrzebuje wejścia do spotkań 1:1).
    if ((body.action === "zoom_get" || body.action === "zoom_save") && tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
    if (body.action === "zoom_get") {
      const z = (await getSetting(base44, "zoom_staly")) || {};
      return Response.json({ link: z.link || "", haslo: z.haslo || "" });
    }
    if (body.action === "zoom_save") {
      const link = String(body.link || "").trim().slice(0, 500);
      if (link && !/^https:\/\/\S+$/.test(link)) throw new Error("Link musi zaczynać się od https:// i nie mieć spacji.");
      const value = { link, haslo: String(body.haslo || "").trim().slice(0, 50) };
      if (!link) await deleteSetting(base44, "zoom_staly"); else await saveSetting(base44, "zoom_staly", value);
      return Response.json({ ok: true, ...value });
    }

    // ---- Ochrona filmów kursu (tylko administrator; klucz pokazywany wyłącznie przy generowaniu) ----
    if (String(body.action || "").startsWith("video_")) {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      const cur = (await getSetting(base44, VIDEO_SETTING)) || {};
      if (body.action === "video_get") {
        return Response.json({ enabled: !!cur.enabled, ttl_h: ttlHours(cur), has_key: !!cur.key, key_created: cur.key_created || null });
      }
      if (body.action === "video_save") {
        if (body.enabled === true && !cur.key) throw new Error("Najpierw wygeneruj klucz i wgraj skrypt na serwer.");
        await saveSetting(base44, VIDEO_SETTING, { ...cur, enabled: body.enabled === true, ttl_h: ttlHours({ ttl_h: body.ttl_h }) });
        return Response.json({ ok: true });
      }
      if (body.action === "video_new_key") {
        const key = newVideoKey();
        // Nowy klucz unieważnia stare linki — ochrona wyłączona do czasu wgrania nowego skryptu.
        await saveSetting(base44, VIDEO_SETTING, { ...cur, key, key_created: new Date().toISOString(), enabled: false });
        return Response.json({ key });
      }
      if (body.action === "video_sign_preview") {
        const r = await signServerVideo(base44, String(body.url || ""), { ...cur, enabled: !!cur.key });
        return Response.json({ url: r?.url || null });
      }
      return Response.json({ error: "Nieznana akcja" }, { status: 400 });
    }

    if (body.action === "delete") {
      const target = body.target;
      if (target !== "payu" && target !== "smtp") {
        throw new Error("Nieznana integracja");
      }
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      await deleteSetting(base44, target);
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
