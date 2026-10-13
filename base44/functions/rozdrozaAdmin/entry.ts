import { createClientFromRequest } from "npm:@base44/sdk@0.8.53";
import { requireAdmin } from "../../shared/supabase.ts";
import { readStory, validateGraph, buildSnapshot, storyMeta, normCategory, slugify, composePrompt, aspectOf, isStartScene } from "../../shared/rozdrozaGraph.ts";
import { getSetting, saveSetting } from "../../shared/settings.ts";

// ROZDROŻA — administracja (tylko rola admin): import z JSON, okładki i obrazy scen,
// raport połączeń, podgląd szkicu i publikacja sprawdzonej kopii. Teksty historii zmienia się ponownym importem.
const MAX_SCENES = 300;
const MAX_CHOICES = 600;

const toEdit = (s) => ({
  scene_key: s.scene_key, title: s.title || "", body: s.body || "", scene_type: s.scene_type,
  image_url: s.image_url || "", alt_text: s.alt_text || "", next_scene_key: s.next_scene_key || "",
  reflection_question: s.reflection_question || "", image_prompt: s.image_prompt || "", sort_order: Number(s.sort_order) || 0,
});
const toChoice = (c) => ({ source_scene_key: c.source_scene_key, target_scene_key: c.target_scene_key, label: c.label || "", sort_order: Number(c.sort_order) || 0 });


// ---- Usługa obrazów: Base44 AI (kredyty aplikacji) albo OpenAI (klucz API wklejony w panelu, nigdy nie wraca do przeglądarki) ----
const AI_SETTING = "obrazy_ai";
const MASK = "********";
const QUALITY = ["low", "medium", "high"];
const cleanModel = (m) => (/^[a-z0-9][a-z0-9._-]{1,60}$/i.test(String(m || "").trim()) ? String(m).trim() : "gpt-image-2");
const aiPublic = (c) => ({
  provider: c.provider === "openai" ? "openai" : "base44", model: cleanModel(c.model), quality: QUALITY.includes(c.quality) ? c.quality : "medium",
  has_key: !!c.openai_key, key_hint: c.openai_key ? `…${String(c.openai_key).slice(-4)}` : "",
});

const b64Bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
async function pickImage(j) {
  const item = j?.data?.[0] || {};
  if (item.b64_json) return { bytes: b64Bytes(item.b64_json), type: "image/png" };
  if (item.url) {
    const im = await fetch(item.url, { signal: AbortSignal.timeout(60000) });
    if (!im.ok) throw new Error("Nie udało się pobrać wygenerowanego obrazu.");
    return { bytes: new Uint8Array(await im.arrayBuffer()), type: im.headers.get("content-type") || "image/png" };
  }
  throw new Error("Usługa nie zwróciła obrazu.");
}

async function genBase44(base44, prompt, aspect) {
  try { return await genBase44Once(base44, prompt, aspect); }
  catch (e) {
    // 400 (zwykle zbyt długi / nieprzyjęty opis) → jedna próba z krótszym promptem.
    if (!/\(400\)/.test(e.message) || prompt.length <= 1200) throw e;
    return await genBase44Once(base44, prompt.slice(0, 1200), aspect);
  }
}

async function genBase44Once(base44, prompt, aspect) {
  const { baseURL, token, headers } = base44.asServiceRole.aiGateway.connection();
  const r = await fetch(`${baseURL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify({ model: "automatic", prompt, n: 1, aspect_ratio: aspect }),
    signal: AbortSignal.timeout(170000),
  });
  const txt = await r.text();
  if (!r.ok) {
    if (r.status === 402 || r.status === 429 || /credit|quota|limit/i.test(txt)) throw new Error("Brak kredytów AI w aplikacji Base44 (albo limit chwilowo wyczerpany).");
    if (/policy|safety|moderat/i.test(txt)) throw new Error("Usługa odrzuciła opis kadru (zasady treści). Zmień prompt i spróbuj ponownie.");
    let why = ""; try { const j = JSON.parse(txt); why = String(j?.error?.message || j?.detail || j?.message || "").slice(0, 200); } catch { why = txt.slice(0, 200); }
    throw new Error(`Generowanie nie powiodło się (${r.status})${why ? `: ${why}` : ""}.`);
  }
  let j; try { j = JSON.parse(txt); } catch { throw new Error("Nieczytelna odpowiedź usługi generowania."); }
  return pickImage(j);
}

// OpenAI: 2:3 → 1024x1536; 16:9 → 2048x1152 (gdy model nie obsługuje — 1536x1024, czytnik kadruje do 16:9).
// Z wzorem postaci (obrazy referencyjne) → /images/edits.
const OA = "https://api.openai.com/v1/images";
const OA_SIZES = { "2:3": ["1024x1536"], "16:9": ["2048x1152", "1536x1024"] };
function oaError(status, txt, model) {
  if (status === 401) return "OpenAI: klucz API jest nieprawidłowy albo został unieważniony — wklej nowy w ustawieniach generowania.";
  if (/insufficient_quota|billing|exceeded your current quota/i.test(txt)) return "OpenAI: brak środków na koncie API (platform.openai.com → Billing).";
  if (status === 429) return "OpenAI: chwilowy limit zapytań — spróbuj za minutę.";
  if (/verif/i.test(txt) && status === 403) return "OpenAI: ten model wymaga weryfikacji organizacji na platform.openai.com (Settings → Organization → Verify).";
  if (/model_not_found|does not exist|invalid model|not have access to model/i.test(txt)) return `OpenAI: model „${model}” jest niedostępny dla tego klucza — zmień model w ustawieniach (np. gpt-image-1).`;
  if (/safety|moderation|policy/i.test(txt)) return "OpenAI odrzuciło opis kadru (zasady treści). Zmień prompt i spróbuj ponownie.";
  return `OpenAI: generowanie nie powiodło się (${status}).`;
}
async function genOpenAI(cfg, prompt, aspect, refs) {
  const model = cleanModel(cfg.model);
  const quality = QUALITY.includes(cfg.quality) ? cfg.quality : "medium";
  const auth = { Authorization: `Bearer ${cfg.openai_key}` };
  const refFiles = [];
  for (const [i, u] of refs.entries()) {
    const r = await fetch(u, { signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (!r?.ok) throw new Error("Nie udało się pobrać wzoru postaci — wgraj go ponownie.");
    const type = r.headers.get("content-type") || "image/png";
    if (!/^image\/(png|jpe?g|webp)/.test(type)) throw new Error("Wzór postaci musi być obrazem PNG, JPG albo WEBP.");
    refFiles.push(new File([new Uint8Array(await r.arrayBuffer())], `wzor-${i + 1}.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`, { type }));
  }
  let fidelity = true;
  const sizes = [...OA_SIZES[aspect] || OA_SIZES["16:9"]];
  for (let attempt = 0; attempt < 4; attempt++) {
    const size = sizes[0];
    let r;
    if (refFiles.length) {
      const fd = new FormData();
      fd.append("model", model); fd.append("prompt", prompt); fd.append("n", "1"); fd.append("size", size); fd.append("quality", quality);
      if (fidelity) fd.append("input_fidelity", "high");
      for (const f of refFiles) fd.append("image[]", f);
      r = await fetch(`${OA}/edits`, { method: "POST", headers: auth, body: fd, signal: AbortSignal.timeout(170000) });
    } else {
      r = await fetch(`${OA}/generations`, {
        method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, n: 1, size, quality }), signal: AbortSignal.timeout(170000),
      });
    }
    const txt = await r.text();
    if (r.ok) { let j; try { j = JSON.parse(txt); } catch { throw new Error("Nieczytelna odpowiedź OpenAI."); } return pickImage(j); }
    // Model nie zna rozmiaru albo parametru wierności wzoru → jedna próba z bezpieczniejszymi ustawieniami.
    if (r.status === 400 && /size/i.test(txt) && sizes.length > 1) { sizes.shift(); continue; }
    if (r.status === 400 && /input_fidelity/i.test(txt) && fidelity) { fidelity = false; continue; }
    throw new Error(oaError(r.status, txt, model));
  }
  throw new Error("OpenAI: generowanie nie powiodło się.");
}

// Wzory postaci: zdjęcia z biblioteki mediów (/functions/media?id=… → krótki podpisany link do wersji WebP) albo adresy https.
async function resolveRefs(base44, story) {
  const list = String(story?.reference_image_url || "").split(/\s+/).filter(Boolean).slice(0, 3);
  const out = [];
  for (const u of list) {
    const m = /^\/functions\/media\?id=([A-Za-z0-9_-]{6,64})/.exec(u);
    if (m) {
      const [a] = await base44.asServiceRole.entities.MediaAsset.filter({ pub_id: m[1] }, null, 1).catch(() => []);
      const w = a?.warianty || {};
      const uri = w[1600] || w["1600"] || w[960] || w["960"] || a?.oryginal_uri;
      if (!uri) throw new Error("Nie znaleziono wzoru postaci w bibliotece mediów — wgraj go ponownie.");
      const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
      out.push(signed_url);
    } else if (/^https:\/\/\S+$/.test(u)) out.push(u);
  }
  return out;
}

// Obraz w proporcjach kadru (16:9 / 2:3), zapisany w plikach aplikacji (publiczny adres media.base44.com).
async function generateImage(base44, prompt, aspect, story) {
  const cfg = (await getSetting(base44, AI_SETTING).catch(() => null)) || {};
  const useOpenAI = cfg.provider === "openai";
  if (useOpenAI && !cfg.openai_key) throw new Error("Wybrano OpenAI, ale nie wklejono klucza API — uzupełnij ustawienia generowania.");
  const { bytes, type } = useOpenAI ? await genOpenAI(cfg, prompt, aspect, await resolveRefs(base44, story)) : await genBase44(base44, prompt, aspect);
  const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  const file = new File([bytes], `rozdroza-${Date.now()}.${ext}`, { type });
  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return file_url;
}

async function publishStory(sr, story, scenes, choices) {
  const report = validateGraph(story, scenes, choices);
  if (!report.ok) return { ok: false, report };
  const version = (Number(story.version) || 0) + 1;
  const snapshot = buildSnapshot(story, scenes, choices, version);
  const meta = { ...storyMeta(story), version };
  await sr.RozdrozaStory.update(story.id, { status: "published", version, published: { meta, snapshot }, published_at: new Date().toISOString() });
  return { ok: true, version, report };
}

function cleanDate(v) {
  const t = Date.parse(String(v || ""));
  if (!Number.isFinite(t) || !/[zZ]|[+-]\d\d:?\d\d$/.test(String(v))) throw new Error("Nieprawidłowa data publikacji.");
  if (t < Date.parse("2020-01-01") || t > Date.now() + 3 * 365 * 864e5) throw new Error("Data publikacji poza zakresem.");
  return new Date(t).toISOString();
}

// +N dni z zachowaniem godziny w czasie polskim (zmiana czasu letni/zimowy nie przesuwa godziny publikacji).
function addDaysWarsaw(t, days) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day + days, +p.hour, +p.minute);
  const off = (u) => { const q = Object.fromEntries(f.formatToParts(new Date(u)).map((x) => [x.type, x.value])); return Date.UTC(+q.year, +q.month - 1, +q.day, +q.hour, +q.minute) - u; };
  let u = local - off(local); u = local - off(u);
  return u;
}

// Poprzednia scena (przez „Dalej” albo wybór) z zatwierdzonym obrazem — pierwsza w kolejności scen.
function previousWithImage(sc, scenes, choices) {
  const keys = new Set([...scenes.filter((x) => x.next_scene_key === sc.scene_key).map((x) => x.scene_key),
    ...choices.filter((c) => c.target_scene_key === sc.scene_key).map((c) => c.source_scene_key)]);
  return scenes.filter((x) => keys.has(x.scene_key) && x.image_url).sort((x, y) => x.sort_order - y.sort_order)[0] || null;
}
// Scena, której zdjęcie faktycznie widać (przy łańcuchu pożyczeń — źródło pierwotne).
const originOf = (prev) => prev.image_from || prev.scene_key;

async function load(sr, id) {
  const story = await sr.RozdrozaStory.get(String(id || "")).catch(() => null);
  if (!story) throw new Error("Nie ma takiej historii.");
  const [scenes, choices] = await Promise.all([
    sr.RozdrozaScene.filter({ story_id: story.id }, "sort_order", MAX_SCENES + 50),
    sr.RozdrozaChoice.filter({ story_id: story.id }, "sort_order", MAX_CHOICES + 50),
  ]);
  return { story, scenes, choices };
}

const listRow = (s) => ({
  id: s.id, slug: s.slug, title: s.title, category: s.category || "", status: s.status || "draft", version: s.version || 0,
  published_at: s.published_at || null, updated_date: s.updated_date, sort_order: s.sort_order ?? 0,
  cover_portrait_url: s.cover_portrait_url || "",
  visible_from: s.visible_from || "",
  // Szkic zmieniony po publikacji → klient widzi jeszcze poprzednią wersję.
  changed: !!(s.status === "published" && s.published_at && s.draft_changed_at && s.draft_changed_at > s.published_at),
});

async function replaceGraph(sr, storyId, scenes, choices) {
  await sr.RozdrozaScene.deleteMany({ story_id: storyId });
  await sr.RozdrozaChoice.deleteMany({ story_id: storyId });
  if (scenes.length) await sr.RozdrozaScene.bulkCreate(scenes.map((s) => ({ story_id: storyId, ...toEdit(s) })));
  if (choices.length) await sr.RozdrozaChoice.bulkCreate(choices.map((c) => ({ story_id: storyId, ...toChoice(c) })));
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await requireAdmin(base44);
    if (me.role !== "admin") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    const sr = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const a = body.action;

    if (a === "list") {
      const rows = await sr.RozdrozaStory.list("sort_order", 300);
      return Response.json({ items: rows.map(listRow) });
    }

    if (a === "get" || a === "preview") {
      const { story, scenes, choices } = await load(sr, body.id);
      const report = validateGraph(story, scenes, choices);
      if (a === "preview") {
        if (!scenes.some((s) => s.scene_key === story.start_scene_key)) return Response.json({ error: "Szkic nie ma sceny startowej — podgląd niemożliwy.", report }, { status: 400 });
        return Response.json({ meta: { ...storyMeta(story), version: 0 }, snapshot: buildSnapshot(story, scenes, choices, 0), report });
      }
      const extra = {};
      for (const k of ["cover_portrait_prompt", "cover_landscape_prompt", "cover_portrait_candidate", "cover_landscape_candidate", "visual_notes", "image_style", "visual_notes_en", "cover_visual_notes_en", "reference_image_url"]) extra[k] = story[k] || "";
      return Response.json({ story: { ...listRow(story), ...storyMeta(story), ...extra, start_scene_key: story.start_scene_key }, scenes, choices, report });
    }

    if (a === "import") {
      const data = body.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.stories) ? data.stories : [data];
      if (!list.length || list.length > 50) throw new Error("Plik nie zawiera historii (albo jest ich ponad 50).");
      const existing = await sr.RozdrozaStory.list("sort_order", 300);
      const bySlug = new Map(existing.map((s) => [s.slug, s]));
      const results = [];
      for (const raw of list) {
        const { story, scenes, choices } = readStory(raw && typeof raw === "object" && !raw.style && data?.style ? { ...raw, style: data.style } : raw);
        const report = validateGraph(story, scenes, choices);
        const res = { slug: story.slug, title: story.title, report, status: "" };
        results.push(res);
        if (!story.slug || !story.title) { res.status = "pominięta (brak tytułu)"; continue; }
        if (!scenes.length) { res.status = "pominięta (brak scen)"; continue; }
        if (scenes.length > MAX_SCENES || choices.length > MAX_CHOICES) { res.status = "pominięta (za dużo scen lub decyzji)"; continue; }
        const old = bySlug.get(story.slug);
        if (old && body.replace !== true) { res.status = "istnieje — zaznacz „Zastąp szkic”, żeby wgrać ponownie"; continue; }
        const fields = { ...story, category: story.category || undefined };
        Object.keys(fields).forEach((k) => (fields[k] === "" || fields[k] === null || fields[k] === undefined) && delete fields[k]);
        if (old) {
          // Zastąpienie szkicu: opublikowana kopia zostaje bez zmian do ponownej publikacji.
          await sr.RozdrozaStory.update(old.id, { ...fields, draft_changed_at: new Date().toISOString() });
          await replaceGraph(sr, old.id, scenes, choices);
          res.status = "zastąpiono szkic"; res.id = old.id;
        } else {
          const created = await sr.RozdrozaStory.create({ ...fields, status: "draft", version: 0, sort_order: existing.length + results.length });
          await replaceGraph(sr, created.id, scenes, choices);
          res.status = "dodano jako szkic"; res.id = created.id;
        }
      }
      return Response.json({ results });
    }

    if (a === "update_story") {
      const { story } = await load(sr, body.id);
      const f = body.fields || {};
      const patch = {};
      const s = (k, max) => { if (typeof f[k] === "string") patch[k] = f[k].trim().slice(0, max); };
      s("title", 200); s("summary", 2000); s("content_warning", 1000); s("cover_portrait_url", 1000); s("cover_landscape_url", 1000); s("start_scene_key", 80);
      s("reading_time", 40); s("cover_portrait_prompt", 3000); s("cover_landscape_prompt", 3000); s("visual_notes", 3000); s("image_style", 2000);
      s("visual_notes_en", 3000); s("cover_visual_notes_en", 3000); s("reference_image_url", 1500);
      if (typeof f.category === "string") patch.category = normCategory(f.category) || undefined;
      if (f.estimated_minutes !== undefined) patch.estimated_minutes = Math.max(0, Math.min(600, Number(f.estimated_minutes) || 0)) || null;
      if (f.sort_order !== undefined) patch.sort_order = Number(f.sort_order) || 0;
      if (typeof f.slug === "string") {
        const slug = slugify(f.slug);
        if (!slug) throw new Error("Adres historii nie może być pusty.");
        const dup = (await sr.RozdrozaStory.filter({ slug }, null, 2)).find((x) => x.id !== story.id);
        if (dup) throw new Error("Taki adres ma już inna historia.");
        patch.slug = slug;
      }
      if (patch.title === "") throw new Error("Tytuł nie może być pusty.");
      await sr.RozdrozaStory.update(story.id, { ...patch, draft_changed_at: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (a === "update_scene") {
      // Tylko obraz i opis obrazu — treści scen zmienia się ponownym importem.
      const sc = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
      if (!sc) throw new Error("Nie ma takiej sceny.");
      const patch = {};
      if (body.image_url !== undefined) {
        patch.image_url = String(body.image_url || "").trim().slice(0, 1000);
        if (patch.image_url !== (sc.image_url || "")) patch.image_from = ""; // własne zdjęcie albo usunięcie
      }
      if (body.alt_text !== undefined) patch.alt_text = String(body.alt_text || "").trim().slice(0, 500);
      if (body.image_prompt !== undefined) patch.image_prompt = String(body.image_prompt || "").trim().slice(0, 3000);
      await sr.RozdrozaScene.update(sc.id, patch);
      await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: new Date().toISOString() }).catch(() => {});
      return Response.json({ ok: true });
    }

    if (a === "publish") {
      const { story, scenes, choices } = await load(sr, body.id);
      const r = await publishStory(sr, story, scenes, choices);
      if (!r.ok) return Response.json({ error: "Historia ma błędy — popraw je przed publikacją.", report: r.report }, { status: 400 });
      return Response.json(r);
    }

    // ---- Harmonogram: opublikowana historia jest widoczna dla klientów dopiero od visible_from ----
    if (a === "schedule") {
      const { story } = await load(sr, body.id);
      const when = body.visible_from ? cleanDate(body.visible_from) : "";
      await sr.RozdrozaStory.update(story.id, { visible_from: when });
      return Response.json({ ok: true, visible_from: when });
    }

    // Plan: historie w podanej kolejności, pierwsza od `start`, kolejne co `every_days` dni.
    // Szkic bez błędów zostaje opublikowany (ukryty do swojej daty); szkic z błędami — pominięty.
    if (a === "schedule_plan") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 100) : [];
      if (!ids.length) throw new Error("Zaznacz historie do harmonogramu.");
      const start = Date.parse(cleanDate(body.start));
      const every = Math.round(Number(body.every_days));
      if (!(every >= 1 && every <= 90)) throw new Error("Odstęp musi wynosić od 1 do 90 dni.");
      const results = [];
      let n = 0;
      for (const id of ids) {
        const { story, scenes, choices } = await load(sr, id);
        const when = new Date(addDaysWarsaw(start, every * n)).toISOString();
        // Najpierw data, potem publikacja — historia nie może ani na chwilę pokazać się przed czasem.
        await sr.RozdrozaStory.update(story.id, { visible_from: when });
        if (story.status !== "published") {
          const r = await publishStory(sr, story, scenes, choices);
          if (!r.ok) {
            await sr.RozdrozaStory.update(story.id, { visible_from: story.visible_from || "" });
            results.push({ id, title: story.title, skipped: "ma błędy — pominięta" }); continue;
          }
        }
        results.push({ id, title: story.title, visible_from: when });
        n++;
      }
      return Response.json({ ok: true, results });
    }

    if (a === "unpublish") {
      const { story } = await load(sr, body.id);
      await sr.RozdrozaStory.update(story.id, { status: "draft" });
      return Response.json({ ok: true });
    }

    if (a === "delete") {
      const { story } = await load(sr, body.id);
      if (story.status === "published") throw new Error("Najpierw wycofaj publikację.");
      await sr.RozdrozaScene.deleteMany({ story_id: story.id });
      await sr.RozdrozaChoice.deleteMany({ story_id: story.id });
      await sr.RozdrozaStory.delete(story.id);
      return Response.json({ ok: true });
    }

    // ---- Grafiki: generowanie (Base44 AI, z limitu kredytów aplikacji), zatwierdzanie, obraz z poprzedniej sceny ----
    if (a === "generate") {
      const kind = ["scene", "cover_portrait", "cover_landscape"].includes(body.kind) ? body.kind : "scene";
      let story, scene = null;
      if (kind === "scene") {
        scene = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
        if (!scene) throw new Error("Nie ma takiej sceny.");
        story = await sr.RozdrozaStory.get(scene.story_id);
      } else story = (await load(sr, body.id)).story;
      const base = kind === "scene" ? scene.image_prompt : kind === "cover_portrait" ? story.cover_portrait_prompt : story.cover_landscape_prompt;
      if (!String(base || "").trim()) throw new Error("Brak opisu kadru (promptu) — uzupełnij go przed generowaniem.");
      const url = await generateImage(base44, composePrompt(kind, base, story), aspectOf(kind), story);
      // Wynik czeka na akceptację — nie podmienia zatwierdzonego obrazu.
      if (kind === "scene") await sr.RozdrozaScene.update(scene.id, { image_candidate_url: url });
      else await sr.RozdrozaStory.update(story.id, { [kind === "cover_portrait" ? "cover_portrait_candidate" : "cover_landscape_candidate"]: url });
      return Response.json({ ok: true, url });
    }

    if (a === "candidate") {
      const kind = ["scene", "cover_portrait", "cover_landscape"].includes(body.kind) ? body.kind : "scene";
      const accept = body.decision === "accept";
      const now = new Date().toISOString();
      if (kind === "scene") {
        const sc = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
        if (!sc?.image_candidate_url) throw new Error("Brak kadru do zatwierdzenia.");
        await sr.RozdrozaScene.update(sc.id, accept ? { image_url: sc.image_candidate_url, image_candidate_url: "", image_from: "" } : { image_candidate_url: "" });
        if (accept) await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: now }).catch(() => {});
      } else {
        const { story } = await load(sr, body.id);
        const c = kind === "cover_portrait" ? "cover_portrait_candidate" : "cover_landscape_candidate";
        const f = kind === "cover_portrait" ? "cover_portrait_url" : "cover_landscape_url";
        if (!story[c]) throw new Error("Brak okładki do zatwierdzenia.");
        await sr.RozdrozaStory.update(story.id, accept ? { [f]: story[c], [c]: "", draft_changed_at: now } : { [c]: "" });
      }
      return Response.json({ ok: true });
    }

    if (a === "use_previous") {
      const sc = await sr.RozdrozaScene.get(String(body.id || "")).catch(() => null);
      if (!sc) throw new Error("Nie ma takiej sceny.");
      // Zatwierdzone zdjęcie zastępujemy tylko po wyraźnym potwierdzeniu administratora.
      if (sc.image_url && body.replace !== true) return Response.json({ error: "Scena ma już zatwierdzone zdjęcie — potwierdź zastąpienie.", needs_confirm: true }, { status: 409 });
      const [scenes, choices] = await Promise.all([
        sr.RozdrozaScene.filter({ story_id: sc.story_id }, "sort_order", MAX_SCENES + 50),
        sr.RozdrozaChoice.filter({ story_id: sc.story_id }, "sort_order", MAX_CHOICES + 50),
      ]);
      const prev = previousWithImage(sc, scenes, choices);
      if (!prev) throw new Error("Poprzednia scena nie ma jeszcze obrazu.");
      await sr.RozdrozaScene.update(sc.id, { image_url: prev.image_url, image_from: originOf(prev) });
      await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: new Date().toISOString() }).catch(() => {});
      return Response.json({ ok: true, from: prev.scene_key });
    }

    // Pkt 3 pakietu: sceny spoza zestawu startowego bez obrazu dostają obraz z poprzedniej sceny (łańcuchowo).
    // Pomija sceny z obrazem, z kadrem czekającym na zatwierdzenie i sceny startowe (te generujemy).
    if (a === "fill_previous") {
      const { story, scenes, choices } = await load(sr, body.id);
      const cur = new Map(scenes.map((s) => [s.scene_key, { ...s }]));
      const filled = [];
      for (let pass = 0, again = true; again && pass < 50; pass++) {
        again = false;
        for (const s of [...cur.values()].sort((x, y) => x.sort_order - y.sort_order)) {
          if (s.image_url || s.image_candidate_url || isStartScene(s.scene_key)) continue;
          const prev = previousWithImage(s, [...cur.values()], choices);
          if (!prev) continue;
          s.image_url = prev.image_url; s.image_from = originOf(prev);
          filled.push(s); again = true;
        }
      }
      for (const s of filled) await sr.RozdrozaScene.update(s.id, { image_url: s.image_url, image_from: s.image_from });
      if (filled.length) await sr.RozdrozaStory.update(story.id, { draft_changed_at: new Date().toISOString() });
      const missing = [...cur.values()].filter((s) => !s.image_url).map((s) => s.scene_key);
      return Response.json({ ok: true, filled: filled.map((s) => ({ key: s.scene_key, from: s.image_from })), missing });
    }

    // ---- Ustawienia usługi obrazów (klucz OpenAI tylko zapisywany; do przeglądarki wraca wyłącznie końcówka) ----
    if (a === "ai_get") return Response.json(aiPublic((await getSetting(base44, AI_SETTING).catch(() => null)) || {}));
    if (a === "ai_save") {
      const prev = (await getSetting(base44, AI_SETTING).catch(() => null)) || {};
      const next = { provider: body.provider === "openai" ? "openai" : "base44", model: cleanModel(body.model), quality: QUALITY.includes(body.quality) ? body.quality : "medium", openai_key: prev.openai_key || "" };
      const key = String(body.openai_key || "").trim();
      if (body.remove_key === true) next.openai_key = "";
      else if (key && key !== MASK) {
        if (!/^sk-[A-Za-z0-9_-]{20,250}$/.test(key)) throw new Error("To nie wygląda na klucz API OpenAI (zaczyna się od sk-).");
        next.openai_key = key;
      }
      if (next.provider === "openai" && !next.openai_key) throw new Error("Aby używać OpenAI, wklej klucz API.");
      await saveSetting(base44, AI_SETTING, next);
      return Response.json(aiPublic(next));
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    return Response.json({ error: error?.message || "Błąd" }, { status: 500 });
  }
}