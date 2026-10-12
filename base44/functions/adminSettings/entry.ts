import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { requireStaff } from "../../shared/supabase.ts";
import { getSetting, saveSetting, deleteSetting, cleanAppUrl, DEFAULT_APP_URL } from "../../shared/settings.ts";
import { cleanFirma, cleanPremiera, PREMIERA_DEFAULT } from "../../shared/firma.ts";
import { syncDocs, publicDocs } from "../../shared/legalDocs.ts";
import { VIDEO_SETTING, signServerVideo, newVideoKey, ttlHours } from "../../shared/videoSign.ts";

const MASK = "********";

const PAYU_KEYS = ["posId", "clientId", "clientSecret", "secondKey", "env"];
const SMTP_KEYS = ["host", "port", "user", "password", "from"];

function maskSecrets(obj, keys) {
  const out = { ...(obj || {}) };
  for (const k of keys) if (out[k]) out[k] = MASK;
  return out;
}

export default async function (req) {
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
      return Response.json({
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

    if (body.action === "save" && body.target === "app") {
      await saveSetting(base44, "app", { url: cleanAppUrl(body.data?.url) });
      return Response.json({ ok: true });
    }

    if (body.action === "save") {
      const target = body.target;
      if (target !== "payu" && target !== "smtp") {
        throw new Error("Nieznana integracja");
      }
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
    if (body.action === "zoom_get") {
      const z = (await getSetting(base44, "zoom_staly")) || {};
      return Response.json({ link: z.link || "", haslo: z.haslo || "", nazwa: z.nazwa || "" });
    }
    if (body.action === "zoom_save") {
      const link = String(body.link || "").trim().slice(0, 500);
      if (link && !/^https:\/\/\S+$/.test(link)) throw new Error("Link musi zaczynać się od https:// i nie mieć spacji.");
      const value = { link, haslo: String(body.haslo || "").trim().slice(0, 50), nazwa: String(body.nazwa || "").trim().slice(0, 60) };
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