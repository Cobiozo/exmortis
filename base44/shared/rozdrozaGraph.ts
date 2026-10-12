// ROZDROŻA — graf historii: odczyt importu, sprawdzenie połączeń, opublikowana kopia.
// Treści (tytuły, narracja, decyzje, zakończenia) przechodzą bez zmian — tylko przycięcie spacji na brzegach.

export const TYPES = ["narrative", "decision", "ending"];
export const CATEGORIES = ["mentalna", "duchowa", "zyciowa"];
const KEY_RE = /^[\p{L}\p{N}_.:-]{1,80}$/u;

const str = (v, max) => (v === null || v === undefined ? "" : String(v)).replace(/^\s+|\s+$/g, "").slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function normCategory(v) {
  const s = slugify(v);
  if (/mental/.test(s)) return "mentalna";
  if (/duchow/.test(s)) return "duchowa";
  if (/zyci/.test(s)) return "zyciowa";
  return CATEGORIES.includes(s) ? s : "";
}

function normType(v) {
  const s = String(v || "").toLowerCase().trim();
  if (["narrative", "narracja", "scena", "scene"].includes(s)) return "narrative";
  if (["decision", "decyzja", "choice", "wybor", "wybór"].includes(s)) return "decision";
  if (["ending", "zakonczenie", "zakończenie", "end", "koniec"].includes(s)) return "ending";
  return s;
}

// Jeden obiekt historii z pliku: { story, scenes, choices } (decyzje także w scenach: scene.choices).
export function readStory(raw) {
  const st = raw?.story && typeof raw.story === "object" ? raw.story : raw || {};
  const scenesIn = Array.isArray(raw?.scenes) ? raw.scenes : Array.isArray(st.scenes) ? st.scenes : [];
  const choicesIn = Array.isArray(raw?.choices) ? raw.choices : Array.isArray(st.choices) ? st.choices : [];
  const story = {
    slug: slugify(st.slug || st.title),
    title: str(st.title, 200),
    summary: str(st.summary ?? st.description, 2000),
    category: normCategory(st.category),
    cover_portrait_url: str(st.cover_portrait_url, 1000),
    cover_landscape_url: str(st.cover_landscape_url, 1000),
    estimated_minutes: num(st.estimated_minutes),
    content_warning: str(st.content_warning, 1000),
    start_scene_key: str(st.start_scene_key, 80),
  };
  const scenes = scenesIn.map((s, i) => ({
    scene_key: str(s?.scene_key ?? s?.key, 80),
    title: str(s?.title, 300),
    body: str(s?.body ?? s?.text, 30000),
    scene_type: normType(s?.scene_type ?? s?.type),
    image_url: str(s?.image_url ?? s?.image, 1000),
    alt_text: str(s?.alt_text ?? s?.alt, 500),
    next_scene_key: str(s?.next_scene_key ?? s?.next, 80),
    reflection_question: str(s?.reflection_question, 1000),
    sort_order: num(s?.sort_order) ?? i,
  }));
  const choices = [];
  choicesIn.forEach((c, i) => choices.push({
    source_scene_key: str(c?.source_scene_key ?? c?.from, 80), target_scene_key: str(c?.target_scene_key ?? c?.to, 80),
    label: str(c?.label ?? c?.text, 500), sort_order: num(c?.sort_order) ?? i,
  }));
  scenesIn.forEach((s) => (Array.isArray(s?.choices) ? s.choices : []).forEach((c, i) => choices.push({
    source_scene_key: str(s?.scene_key ?? s?.key, 80), target_scene_key: str(c?.target_scene_key ?? c?.to, 80),
    label: str(c?.label ?? c?.text, 500), sort_order: num(c?.sort_order) ?? i,
  })));
  if (!story.start_scene_key && scenes[0]) story.start_scene_key = scenes[0].scene_key;
  return { story, scenes, choices };
}

// Sprawdzenie grafu. errors blokują publikację, warnings są informacją dla administratora.
export function validateGraph(story, scenes, choices) {
  const errors = [], warnings = [];
  if (!story.title) errors.push("Brak tytułu historii.");
  if (!story.slug) errors.push("Brak adresu (slug) historii.");
  if (!story.category) warnings.push("Brak kategorii (mentalna / duchowa / życiowa).");
  const by = new Map();
  for (const s of scenes) {
    if (!s.scene_key) { errors.push("Scena bez scene_key."); continue; }
    if (!KEY_RE.test(s.scene_key)) errors.push(`Nieprawidłowy scene_key „${s.scene_key}”.`);
    if (by.has(s.scene_key)) errors.push(`Powtórzony scene_key „${s.scene_key}”.`);
    by.set(s.scene_key, s);
    if (!TYPES.includes(s.scene_type)) errors.push(`Scena „${s.scene_key}”: nieznany typ „${s.scene_type}” (narrative / decision / ending).`);
    if (!s.body && s.scene_type !== "decision") warnings.push(`Scena „${s.scene_key}”: brak tekstu.`);
  }
  const out = new Map(scenes.map((s) => [s.scene_key, []]));
  for (const c of choices) {
    if (!by.has(c.source_scene_key)) { errors.push(`Decyzja „${c.label || "?"}”: scena źródłowa „${c.source_scene_key}” nie istnieje.`); continue; }
    if (!c.label) errors.push(`Decyzja w scenie „${c.source_scene_key}” bez tekstu.`);
    if (!by.has(c.target_scene_key)) errors.push(`Decyzja „${c.label}” (${c.source_scene_key}) prowadzi do nieistniejącej sceny „${c.target_scene_key}”.`);
    out.get(c.source_scene_key).push(c);
  }
  if (!story.start_scene_key || !by.has(story.start_scene_key)) errors.push(`Scena startowa „${story.start_scene_key || "—"}” nie istnieje.`);

  const edges = new Map();
  for (const s of scenes) {
    const ch = (out.get(s.scene_key) || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    if (s.scene_type === "narrative") {
      if (!s.next_scene_key) errors.push(`Scena „${s.scene_key}” (narracja) nie ma next_scene_key.`);
      else if (!by.has(s.next_scene_key)) errors.push(`Scena „${s.scene_key}”: next_scene_key „${s.next_scene_key}” nie istnieje.`);
      if (ch.length) warnings.push(`Scena „${s.scene_key}” (narracja) ma decyzje — zostaną pominięte.`);
      edges.set(s.scene_key, s.next_scene_key && by.has(s.next_scene_key) ? [s.next_scene_key] : []);
    } else if (s.scene_type === "decision") {
      if (!ch.length) errors.push(`Scena „${s.scene_key}” (decyzja) nie ma żadnych wyborów.`);
      else if (ch.length !== 2) warnings.push(`Scena „${s.scene_key}”: ${ch.length} wybory (zwykle są 2).`);
      const t = ch.map((c) => c.target_scene_key);
      if (t.length > 1 && new Set(t).size === 1) warnings.push(`Scena „${s.scene_key}”: wszystkie wybory prowadzą do tej samej sceny „${t[0]}”.`);
      edges.set(s.scene_key, t.filter((k) => by.has(k)));
    } else if (s.scene_type === "ending") {
      if (s.next_scene_key || ch.length) warnings.push(`Zakończenie „${s.scene_key}” ma dalsze połączenia — zostaną pominięte.`);
      if (!s.reflection_question) warnings.push(`Zakończenie „${s.scene_key}” nie ma pytania refleksyjnego.`);
      edges.set(s.scene_key, []);
    }
    if (s.scene_type !== "ending" && s.reflection_question) warnings.push(`Scena „${s.scene_key}”: pytanie refleksyjne pokazuje się tylko w zakończeniach.`);
    if (!s.image_url) warnings.push(`Scena „${s.scene_key}”: brak obrazu.`);
    else if (!s.alt_text) warnings.push(`Scena „${s.scene_key}”: obraz bez opisu (alt).`);
  }

  // Osiągalność od startu, zakończenia i ślepe zaułki (pętle bez wyjścia).
  const reach = new Set();
  if (by.has(story.start_scene_key)) {
    const q = [story.start_scene_key];
    while (q.length) { const k = q.pop(); if (reach.has(k)) continue; reach.add(k); for (const t of edges.get(k) || []) q.push(t); }
  }
  const endings = scenes.filter((s) => s.scene_type === "ending").map((s) => s.scene_key);
  const reachEnd = endings.filter((k) => reach.has(k));
  if (!reachEnd.length && by.has(story.start_scene_key)) errors.push("Od sceny startowej nie da się dojść do żadnego zakończenia.");
  const canEnd = new Set(endings);
  let changed = true;
  while (changed) { changed = false; for (const [k, ts] of edges) if (!canEnd.has(k) && ts.some((t) => canEnd.has(t))) { canEnd.add(k); changed = true; } }
  for (const k of reach) if (!canEnd.has(k) && by.get(k)?.scene_type !== "ending" && TYPES.includes(by.get(k)?.scene_type)) errors.push(`Ze sceny „${k}” nie da się dojść do zakończenia (pętla bez wyjścia albo urwana ścieżka).`);
  const unreachable = scenes.filter((s) => s.scene_key && !reach.has(s.scene_key)).map((s) => s.scene_key);
  if (unreachable.length) warnings.push(`Sceny nieosiągalne od startu: ${unreachable.join(", ")}.`);
  // Pętle (cykle) — dozwolone tylko świadomie; zgłaszamy jako ostrzeżenie.
  const color = new Map(); let cycle = null;
  const dfs = (k, path) => {
    if (cycle) return; color.set(k, 1); path.push(k);
    for (const t of edges.get(k) || []) { if (color.get(t) === 1) { cycle = path.slice(path.indexOf(t)).concat(t); return; } if (!color.get(t)) dfs(t, path); }
    path.pop(); color.set(k, 2);
  };
  if (by.has(story.start_scene_key)) dfs(story.start_scene_key, []);
  if (cycle) warnings.push(`Pętla w historii: ${cycle.join(" → ")}. Sprawdź, czy jest zamierzona.`);

  const decisions = scenes.filter((s) => s.scene_type === "decision" && reach.has(s.scene_key)).length;
  return { ok: !errors.length, errors: [...new Set(errors)], warnings: [...new Set(warnings)],
    stats: { scenes: scenes.length, choices: choices.length, decisions, endings: endings.length, reachable_endings: reachEnd.length } };
}

// Opublikowana kopia: tylko to, czego potrzebuje czytnik (krótkie klucze, decyzje przy scenach).
export function buildSnapshot(story, scenes, choices, version) {
  const out = new Map();
  for (const c of choices) { if (!out.has(c.source_scene_key)) out.set(c.source_scene_key, []); out.get(c.source_scene_key).push(c); }
  const sc = {};
  for (const s of scenes) {
    const e = { t: s.title || "", b: s.body || "", y: s.scene_type };
    if (s.image_url) { e.i = s.image_url; e.a = s.alt_text || ""; }
    if (s.scene_type === "narrative") e.n = s.next_scene_key;
    if (s.scene_type === "decision") e.c = (out.get(s.scene_key) || []).slice().sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ l: c.label, to: c.target_scene_key }));
    if (s.scene_type === "ending" && s.reflection_question) e.q = s.reflection_question;
    sc[s.scene_key] = e;
  }
  return { v: version, start: story.start_scene_key, scenes: sc };
}

export function storyMeta(s) {
  return {
    id: s.id, slug: s.slug, title: s.title, summary: s.summary || "", category: s.category || "",
    cover_portrait_url: s.cover_portrait_url || "", cover_landscape_url: s.cover_landscape_url || "",
    estimated_minutes: s.estimated_minutes || null, content_warning: s.content_warning || "", version: s.version || 0,
  };
}
