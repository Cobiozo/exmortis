import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { requireAdmin } from "../../shared/supabase.ts";
import { readStory, validateGraph, buildSnapshot, storyMeta, normCategory, slugify } from "../../shared/rozdrozaGraph.ts";

// ROZDROŻA — administracja (tylko rola admin): import z JSON, okładki i obrazy scen,
// raport połączeń, podgląd szkicu i publikacja sprawdzonej kopii. Teksty historii zmienia się ponownym importem.
const MAX_SCENES = 300;
const MAX_CHOICES = 600;

const toEdit = (s) => ({
  scene_key: s.scene_key, title: s.title || "", body: s.body || "", scene_type: s.scene_type,
  image_url: s.image_url || "", alt_text: s.alt_text || "", next_scene_key: s.next_scene_key || "",
  reflection_question: s.reflection_question || "", sort_order: Number(s.sort_order) || 0,
});
const toChoice = (c) => ({ source_scene_key: c.source_scene_key, target_scene_key: c.target_scene_key, label: c.label || "", sort_order: Number(c.sort_order) || 0 });

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
      return Response.json({ story: { ...listRow(story), ...storyMeta(story), start_scene_key: story.start_scene_key }, scenes, choices, report });
    }

    if (a === "import") {
      const data = body.data;
      const list = Array.isArray(data) ? data : Array.isArray(data?.stories) ? data.stories : [data];
      if (!list.length || list.length > 50) throw new Error("Plik nie zawiera historii (albo jest ich ponad 50).");
      const existing = await sr.RozdrozaStory.list("sort_order", 300);
      const bySlug = new Map(existing.map((s) => [s.slug, s]));
      const results = [];
      for (const raw of list) {
        const { story, scenes, choices } = readStory(raw);
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
      await sr.RozdrozaScene.update(sc.id, {
        image_url: String(body.image_url || "").trim().slice(0, 1000), alt_text: String(body.alt_text || "").trim().slice(0, 500),
      });
      await sr.RozdrozaStory.update(sc.story_id, { draft_changed_at: new Date().toISOString() }).catch(() => {});
      return Response.json({ ok: true });
    }

    if (a === "publish") {
      const { story, scenes, choices } = await load(sr, body.id);
      const report = validateGraph(story, scenes, choices);
      if (!report.ok) return Response.json({ error: "Historia ma błędy — popraw je przed publikacją.", report }, { status: 400 });
      const version = (Number(story.version) || 0) + 1;
      const snapshot = buildSnapshot(story, scenes, choices, version);
      const meta = { ...storyMeta(story), version };
      const at = new Date().toISOString();
      await sr.RozdrozaStory.update(story.id, { status: "published", version, published: { meta, snapshot }, published_at: at });
      return Response.json({ ok: true, version, report });
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

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    if (error?.message === "FORBIDDEN") return Response.json({ error: "Brak dostępu" }, { status: 403 });
    return Response.json({ error: error?.message || "Błąd" }, { status: 500 });
  }
}
