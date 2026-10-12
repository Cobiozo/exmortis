// ROZDROŻA — silnik fabularny (czyste funkcje, bez interfejsu i bez sieci).
// Stan czytelnika: { scene, stack: [klucze odwiedzonych scen], picks: [{ at, idx }], done }.
// Kopia historii (snapshot): { v, start, scenes: { [klucz]: { t, b, y, i?, a?, n?, c?: [{ l, to }], q? } } }.

const MAX_STACK = 1000;

export const sceneOf = (snap, key) => snap?.scenes?.[key] || null;

// Krawędzie dozwolone ze sceny (do sprawdzania zapisu i ścieżek).
export function targets(snap, key) {
  const s = sceneOf(snap, key);
  if (!s) return [];
  if (s.y === "narrative") return s.n ? [s.n] : [];
  if (s.y === "decision") return (s.c || []).map((c) => c.to);
  return [];
}

// Minimalne sprawdzenie kopii przed czytaniem — zamiast białego ekranu czytelnik dostaje komunikat.
export function checkSnapshot(snap) {
  if (!snap?.scenes || typeof snap.scenes !== "object") return "Historia jest niekompletna.";
  if (!sceneOf(snap, snap.start)) return "Historia nie ma sceny początkowej.";
  return null;
}

export const initState = (snap) => ({ scene: snap.start, stack: [snap.start], picks: [], done: sceneOf(snap, snap.start)?.y === "ending" });

function go(snap, st, to, pick) {
  if (!sceneOf(snap, to)) return { ...st, error: `Brakuje sceny „${to}”.` };
  const stack = st.stack.concat(to).slice(-MAX_STACK);
  return { scene: to, stack, picks: pick ? st.picks.concat(pick) : st.picks, done: sceneOf(snap, to).y === "ending" };
}

export function next(snap, st) {
  const s = sceneOf(snap, st.scene);
  if (!s || s.y !== "narrative" || !s.n) return st;
  return go(snap, st, s.n);
}

export function choose(snap, st, idx) {
  const s = sceneOf(snap, st.scene);
  const c = s?.y === "decision" ? s.c?.[idx] : null;
  if (!c) return st;
  return go(snap, st, c.to, { at: st.scene, idx });
}

// Cofnięcie o jedną scenę (także cofnięcie decyzji).
export function back(snap, st) {
  if (st.stack.length < 2) return st;
  const stack = st.stack.slice(0, -1);
  const scene = stack[stack.length - 1];
  const picks = st.picks.slice();
  if (sceneOf(snap, scene)?.y === "decision" && picks.length && picks[picks.length - 1].at === scene) picks.pop();
  return { scene, stack, picks, done: false };
}

// Ostatnia rzeczywiście podjęta decyzja na tej ścieżce (do „Zobacz inną drogę”).
export function lastDecision(st) {
  for (let i = st.stack.length - 1; i >= 0; i--) {
    const k = st.stack[i];
    if (st.picks.some((p) => p.at === k) && i < st.stack.length - 1) return { index: i, key: k };
  }
  return null;
}

// Powrót do ostatniej decyzji; poprzedni wybór zostaje zapamiętany, żeby go pokazać.
export function otherPath(snap, st) {
  const d = lastDecision(st);
  if (!d) return st;
  const prev = [...st.picks].reverse().find((p) => p.at === d.key);
  const stack = st.stack.slice(0, d.index + 1);
  const picks = st.picks.slice();
  const pi = picks.map((p) => p.at).lastIndexOf(d.key);
  if (pi >= 0) picks.splice(pi, 1);
  return { scene: d.key, stack, picks, done: false, previous: prev ? { at: d.key, idx: prev.idx } : null };
}

// Odtworzenie zapisu: ta sama wersja → wprost; inna wersja → tylko gdy cała ścieżka nadal istnieje.
export function restore(snap, saved) {
  if (!saved || !Array.isArray(saved.stack) || !saved.stack.length) return { state: null };
  const fits = saved.stack[0] === snap.start && saved.stack.every((k, i) => sceneOf(snap, k) && (i === 0 || targets(snap, saved.stack[i - 1]).includes(k)));
  if (!fits) return { state: null, incompatible: saved.v !== snap.v };
  const scene = saved.stack[saved.stack.length - 1];
  const picks = (Array.isArray(saved.picks) ? saved.picks : []).filter((p) => saved.stack.includes(p?.at) && Number.isInteger(p?.idx));
  return { state: { scene, stack: saved.stack.slice(-MAX_STACK), picks, done: sceneOf(snap, scene).y === "ending" }, migrated: saved.v !== snap.v };
}

// ---- Zapis postępu w przeglądarce (osobno dla każdego konta) ----
const progKey = (uid, storyId) => `exm_rz_prog:${uid || "anon"}:${storyId}`;

export function readProgress(uid, storyId) {
  try { const p = JSON.parse(localStorage.getItem(progKey(uid, storyId))); return p && typeof p === "object" ? p : null; } catch { return null; }
}

export function writeProgress(uid, storyId, v, st, endedBefore) {
  try {
    const prev = readProgress(uid, storyId);
    const ended = Array.from(new Set([...(prev?.ended || []), ...(endedBefore || []), ...(st.done ? [st.scene] : [])])).slice(-50);
    localStorage.setItem(progKey(uid, storyId), JSON.stringify({ v, stack: st.stack, picks: st.picks, scene: st.scene, done: st.done, ended, at: Date.now() }));
    return true;
  } catch { return false; }
}

export function clearProgress(uid, storyId) {
  try {
    const prev = readProgress(uid, storyId);
    // „Od początku” zachowuje informację o ukończeniu (znacznik w bibliotece).
    if (prev?.ended?.length) localStorage.setItem(progKey(uid, storyId), JSON.stringify({ ended: prev.ended, at: Date.now() }));
    else localStorage.removeItem(progKey(uid, storyId));
  } catch { /* */ }
}

// ---- Preferencje czytnika ----
const PREF_KEY = (uid) => `exm_rz_prefs:${uid || "anon"}`;
export const FONT_STEPS = [0.9, 1, 1.12, 1.25, 1.4];
export function readPrefs(uid) {
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY(uid))) || {}; return { font: FONT_STEPS.includes(p.font) ? p.font : 1, images: p.images !== false }; }
  catch { return { font: 1, images: true }; }
}
export function writePrefs(uid, p) { try { localStorage.setItem(PREF_KEY(uid), JSON.stringify(p)); } catch { /* */ } }
