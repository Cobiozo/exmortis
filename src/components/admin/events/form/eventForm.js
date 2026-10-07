// Model formularza spotkania: domyślne wartości, walidacja kroków, szkic lokalny, zapis.
export const EVENT_TYPES = ["Spotkanie otwarte", "Wieczór powrotu", "Live", "Webinar", "Warsztat", "Warsztat online", "Krąg", "Retreat", "Spotkanie stacjonarne", "Inne"];
export const REG_TYPES = ["Zapis na stronie", "Link zewnętrzny", "Bez zapisu"];
export const STAGES = ["Śmierć", "Próg", "Powrót", "Inny", "Wszystkie"];
export const STEPS = ["Podstawy", "Okładka", "Dostęp i zapisy", "Podgląd i publikacja"];

const pad = (n) => String(n).padStart(2, "0");
const localParts = (iso) => {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};
const localInput = (iso) => { const p = localParts(iso); return p.date ? `${p.date}T${p.time}` : ""; };

export function initForm(ev) {
  const base = {
    title: "", slug: "", subtitle: "", event_type: "Spotkanie otwarte", format: "Online", duration_minutes: 60,
    location: "", description: "", for_whom: "", price: 0, checkout_url: "", capacity: "", registration_type: "Zapis na stronie",
    external_url: "", join_link: "", join_password: "", recording_url: "", recording_until: "", registration_deadline: "",
    what_registered: "", mailing_group: "", cancel_reason: "", stage: "Wszystkie", status: "Szkic", cover: null,
  };
  if (!ev) return { ...base, date: "", time: "20:00", paid: false };
  let cover = ev.cover;
  if (typeof cover === "string") { try { cover = JSON.parse(cover); } catch { cover = null; } }
  if (!cover && ev.cover_image) cover = { src: ev.cover_image, alt: "", fx: 0.5, fy: 0.5, dim: 45, source: "wgrana", crops: {}, stale: true };
  const f = { ...base };
  for (const k of Object.keys(base)) if (ev[k] !== undefined && ev[k] !== null) f[k] = ev[k];
  return { ...f, id: ev.id, cover, ...localParts(ev.start_datetime), paid: Number(ev.price) > 0,
    recording_until: localInput(ev.recording_until), registration_deadline: localInput(ev.registration_deadline) };
}

export const startIso = (f) => (f.date && f.time ? new Date(`${f.date}T${f.time}`).toISOString() : null);

// Błędy dla kroku (publish = pełna kontrola przed publikacją).
export function stepErrors(f, step, publish = false) {
  const e = {};
  if (step === 0) {
    if (!f.title.trim()) e.title = "Podaj tytuł spotkania";
    if (!f.date) e.date = "Podaj datę spotkania";
    if (!f.time) e.time = "Podaj godzinę spotkania";
    if (!(Number(f.duration_minutes) >= 5)) e.duration_minutes = "Podaj czas trwania (min. 5 minut)";
    if (publish && f.date && f.time && new Date(`${f.date}T${f.time}`) < new Date()) e.date = "Data nie może być w przeszłości";
  }
  if (step === 1 && f.cover?.src && !String(f.cover.alt || "").trim()) e.cover_alt = "Dodaj opis obrazu dla czytników ekranu";
  if (step === 2) {
    if (f.paid && !(Number(f.price) > 0)) e.price = "Podaj cenę spotkania";
    if (f.paid && !f.checkout_url) e.checkout_url = "Podaj link płatności";
    if (f.format === "Stacjonarnie" && !f.location.trim()) e.location = "Podaj adres spotkania";
    if (f.registration_type === "Link zewnętrzny" && !f.external_url) e.external_url = "Podaj link do transmisji lub zapisu";
    if (publish && f.format === "Online" && !f.join_link && !f.external_url) e.join_link = "Spotkanie online wymaga linku Zoom albo linku transmisji";
  }
  return e;
}
export const allErrors = (f, publish) => [0, 1, 2].reduce((a, s) => ({ ...a, ...stepErrors(f, s, publish) }), {});

export function toPayload(f, status) {
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  const { date, time, paid, cover, ...rest } = f;
  return {
    ...rest, id: f.id || null, status, start_datetime: startIso(f),
    duration_minutes: Number(f.duration_minutes) || 60, price: paid ? Number(f.price) || 0 : 0, checkout_url: paid ? f.checkout_url : "",
    location: f.format === "Online" ? f.location || "Online, Zoom" : f.location,
    capacity: f.capacity === "" || f.capacity === null ? null : Number(f.capacity),
    registration_deadline: iso(f.registration_deadline), recording_until: iso(f.recording_until),
    cover: cover?.src ? cover : null, cover_image: cover?.crops?.wide || cover?.src || "",
  };
}

// Szkic lokalny (przetrwa odświeżenie strony).
const key = (id) => `exm_event_draft_${id || "nowe"}`;
export const loadDraft = (id) => { try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; } };
export const saveDraft = (id, form) => { const at = new Date().toISOString(); localStorage.setItem(key(id), JSON.stringify({ at, form })); return at; };
export const clearDraft = (id) => localStorage.removeItem(key(id));