import { createClientFromRequest } from "../_shared/compat.ts";
import { requireStaff } from "../_shared/supabase.ts";
import { getSetting, saveSetting, deleteSetting, cleanAppUrl, DEFAULT_APP_URL } from "../_shared/settings.ts";
import { cleanFirma, cleanPremiera, PREMIERA_DEFAULT } from "../_shared/firma.ts";
import { cleanAplikacja } from "../_shared/appOffline.ts";
import { cleanPopup, POPUP_DEFAULT, cleanCampaign, codeInfo, campaignFromLegacy } from "../_shared/popup.ts";
import { runSql, escStr } from "../_shared/supabase.ts";
import { clearSnap } from "../_shared/snapshot.ts";
import { unitPrice } from "../_shared/productPrice.ts";
import { cleanPomiar, validatePomiar, POMIAR_DEFAULT } from "../_shared/tracking.ts";
import { cleanFaktury, fakturyToken } from "../_shared/invoices.ts";
import { syncDocs, publicDocs } from "../_shared/legalDocs.ts";
import { VIDEO_SETTING, signServerVideo, newVideoKey, ttlHours } from "../_shared/videoSign.ts";
import { payuToken } from "../_shared/payu.ts";

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
        // Adres powiadomień taki sam jak w zamówieniu: przez exmortis.pl (server.js przekazuje do funkcji edge Supabase).
        backend: "supabase",
        notifyUrl: `${String(app?.url || DEFAULT_APP_URL).replace(/\/+$/, "")}/functions/payuNotification`,
        payu: payu ? maskSecrets(payu, ["clientSecret", "secondKey"]) : {},
        smtp: smtp ? maskSecrets(smtp, ["password"]) : {},
      });
    }

    // Test autoryzacji OAuth na ZAPISANYCH danych — sekrety nie wracają do przeglądarki.
    if (body.action === "payu_test") {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      const payu = await getSetting(base44, "payu");
      if (!payu?.clientId || !payu?.clientSecret) {
        return Response.json({ error: "Najpierw zapisz Client ID i Client Secret" }, { status: 400 });
      }
      try {
        const { expiresIn } = await payuToken(payu);
        return Response.json({
          ok: true,
          env: payu.env === "sandbox" ? "sandbox" : "secure",
          posId_set: !!payu.posId,
          secondKey_set: !!payu.secondKey,
          expires_in: expiresIn,
        });
      } catch (e) {
        const msg = String(e?.message || e);
        const reason = msg === "PAYU_OAUTH_FAILED"
          ? "PayU odrzuciło Client ID lub Client Secret dla wybranego środowiska."
          : msg.includes("TIMEOUT")
            ? "PayU nie odpowiedziało w wyznaczonym czasie."
            : msg.includes("NETWORK")
              ? "Brak połączenia z PayU."
              : "Nie udało się zalogować do PayU.";
        return Response.json({ error: reason }, { status: 400 });
      }
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

    // Popup na stronie — tekst, przycisk i kod widoczne publicznie; zmienia administrator i zespół techniczny.
    // Kod powitalny dla nowych kont (−20%, 7 dni) — włącznik.
    if (body.action === "get_powitalny") {
      const v = await getSetting(base44, "powitalny");
      return Response.json({ wlaczony: v?.wlaczony !== false });
    }
    if (body.action === "save" && body.target === "powitalny") {
      if (tech) return Response.json({ error: "Brak dostępu" }, { status: 403 });
      await saveSetting(base44, "powitalny", { wlaczony: body.data?.wlaczony !== false });
      return Response.json({ ok: true, wlaczony: body.data?.wlaczony !== false });
    }
    if (body.action === "get_popup") {
      return Response.json({ popup: { ...POPUP_DEFAULT, ...((await getSetting(base44, "popup")) || {}) } });
    }
    if (body.action === "save" && body.target === "popup") {
      const prev = (await getSetting(base44, "popup")) || {};
      const value = cleanPopup(body.data, prev.wersja);
      if (value.aktywny && !value.tytul && !value.tresc) return Response.json({ error: "Wpisz tytuł albo treść popupu." }, { status: 400 });
      if (value.od && value.do && value.do <= value.od) return Response.json({ error: "Data końca musi być po dacie początku." }, { status: 400 });
      await saveSetting(base44, "popup", value);
      return Response.json({ ok: true, popup: value });
    }

    // ---- Kampanie popup (17.11.2026) ----
    const loadCampaigns = async () => {
      const v = await getSetting(base44, "popup_kampanie");
      if (Array.isArray(v?.items)) return v.items;
      const legacy = campaignFromLegacy(await getSetting(base44, "popup"));
      return legacy ? [legacy] : [];
    };
    const saveCampaigns = async (items) => {
      await saveSetting(base44, "popup_kampanie", { items: items.slice(0, 50) });
      await clearSnap(base44, "popups").catch(() => {});
    };
    if (body.action === "get_popups") {
      const items = await loadCampaigns();
      const [stats, sales, products, events, codes] = await Promise.all([
        runSql(base44, `SELECT kampania, SUM(wysw)::int AS wysw, SUM(klik)::int AS klik, SUM(zamk)::int AS zamk,
          MIN(dzien)::text AS od FROM public.popup_stats GROUP BY kampania`, true).catch(() => []),
        runSql(base44, `SELECT upper(discount_code) AS kod, COUNT(*)::int AS ile, COALESCE(SUM(total),0)::float8 AS suma
          FROM public.orders WHERE status = 'COMPLETED' AND COALESCE(is_test,false) = false AND discount_code IS NOT NULL
          GROUP BY 1`, true).catch(() => []),
        runSql(base44, `SELECT id::text AS id, name, slug, product_type, status, active, image_url, price::float8 AS price,
          price_regular::float8 AS price_regular, price_start::float8 AS price_start, promo_end_date::text AS promo_end_date, price_steps
          FROM public.products p WHERE active IS NOT FALSE ORDER BY sort_order NULLS LAST, name`, true),
        runSql(base44, `SELECT id::text AS id, title, start_datetime, format, price::float8 AS price, registration_deadline
          FROM public.events WHERE status = 'Opublikowane' AND start_datetime > now() ORDER BY start_datetime LIMIT 30`, true),
        runSql(base44, `SELECT data FROM public.exm_discountcode WHERE COALESCE(data->>'email','') = '' AND COALESCE(data->>'opis','') NOT LIKE 'Karta podarunkowa%' ORDER BY created_date DESC LIMIT 100`, true),
      ]);
      const kody = [];
      for (const r of codes) {
        const c = r.data || {};
        if (!c.code) continue;
        const ci = await codeInfo(base44, String(c.code).toUpperCase(), null);
        kody.push({ kod: String(c.code).toUpperCase(), kind: c.kind, value: c.value, active: c.active === true, od: c.od || null,
          valid_until: c.valid_until || null, bez_promocji: c.bez_promocji === true, tylko_subskrybenci: c.tylko_subskrybenci === true,
          tylko_konto: c.tylko_konto === true, product_ids: c.product_ids || [], ok: !!ci?.ok, powod: ci?.ok ? "" : ci?.powod || "" });
      }
      return Response.json({
        items, stats, sales,
        products: products.map((x) => ({ id: x.id, name: x.name, slug: x.slug, typ: x.product_type, status: x.status, cena: unitPrice(x),
          obraz: /^https:\/\//.test(String(x.image_url || "")) ? x.image_url : "",
          cena_regularna: x.price_regular != null ? Number(x.price_regular) : Number(x.price) })),
        events: events.map((e) => ({ id: e.id, title: e.title, start: e.start_datetime, format: e.format, bezplatne: !(Number(e.price) > 0),
          zapisy_do: e.registration_deadline || null })),
        kody,
      });
    }
    if (body.action === "save_popup") {
      const items = await loadCampaigns();
      const i = items.findIndex((k) => k.id === body.data?.id);
      const value = cleanCampaign(body.data, i >= 0 ? items[i] : {});
      const bad = (msg) => Response.json({ error: msg }, { status: 400 });
      if (!value.tytul && !value.tresc) return bad("Wpisz tytuł albo treść popupu.");
      if (value.od && value.do && value.do <= value.od) return bad("Data końca musi być po dacie początku.");
      if (value.rodzaj === "produkt" && !value.produkt_id) return bad("Wybierz produkt.");
      if (value.rodzaj === "spotkanie" && !value.wydarzenie_id) return bad("Wybierz spotkanie.");
      if (value.rodzaj === "rabat" && !value.kod) return bad("Wybierz kod rabatowy.");
      if (value.gdzie === "wybrane" && !value.sciezki.length) return bad("Dodaj co najmniej jedną stronę (np. /skarbiec).");
      if ((value.akcja === "link") && !value.przycisk_link) return bad("Wpisz adres przycisku (strona zaczynająca się od / albo https://).");
      let ostrzezenie = "";
      if (value.kod) {
        const ci = await codeInfo(base44, value.kod, null);
        if (!ci?.ok) ostrzezenie = `Kod ${value.kod}: ${ci?.powod || "nieważny"} — kampania nie pokaże się, dopóki kod nie zacznie działać.`;
      }
      if (i >= 0) items[i] = value; else items.unshift(value);
      await saveCampaigns(items);
      return Response.json({ ok: true, item: value, ostrzezenie });
    }
    if (body.action === "popup_action") {
      const items = await loadCampaigns();
      const i = items.findIndex((k) => k.id === body.id);
      if (i < 0) return Response.json({ error: "Nie ma takiej kampanii." }, { status: 404 });
      const k = items[i];
      const now = new Date().toISOString();
      const op = String(body.op || "");
      if (op === "duplikuj") {
        items.unshift(cleanCampaign({ ...k, id: undefined, nazwa: `${k.nazwa} (kopia)`.slice(0, 80), status: "szkic" }, {}));
      } else if (op === "wstrzymaj") items[i] = { ...k, status: "wstrzymana", zmieniono: now };
      else if (op === "wznow" || op === "aktywuj") items[i] = { ...k, status: "aktywna", zmieniono: now };
      else if (op === "zakoncz") items[i] = { ...k, status: "zakonczona", zmieniono: now };
      else if (op === "usun") {
        if (k.status !== "szkic") return Response.json({ error: "Usunąć można tylko szkic. Kampanię zakończ — zostanie w historii." }, { status: 400 });
        items.splice(i, 1);
      } else return Response.json({ error: "Nieznana operacja" }, { status: 400 });
      await saveCampaigns(items);
      return Response.json({ ok: true, items });
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