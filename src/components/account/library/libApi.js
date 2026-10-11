import { base44 } from "@/api/base44Client";

// Strona klienta: jedno wejście do modułu biblioteki i wiadomości (funkcja „library").
// Przy obu przełącznikach „off" funkcja zwraca 404 — wtedy po prostu nic nie pokazujemy.
const call = async (action, payload = {}) => (await base44.functions.invoke("library", { action, ...payload })).data;

export const libConfig = () => call("config").catch(() => ({ library: false, messages: false, footer: null }));
export const myLibrary = () => call("my_library");
export const myMessages = () => call("my_messages");
export const unreadMessage = () => call("unread");
export const openMaterial = (material_id) => call("open_material", { material_id });
export const refreshLink = (material_id) => call("refresh_link", { material_id });
export const markCompleted = (material_id, completed) => call("mark_completed", { material_id, completed });
export const readMessage = (message_id) => call("read_message", { message_id });
export const hideMessage = (message_id) => call("hide_message", { message_id });

export const KIND = { PDF: "PDF", AUDIO: "Audio", WIDEO: "Wideo", LINK: "Link", TEKST: "Tekst" };

export const mmss = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

export const plainText = (html) =>
  String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export const plDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "";

// „2026-08-14T12:00:00Z" → „14 sierpnia 2026, 14:00 (CZASU PL)"
export const plDateTime = (iso) =>
  iso ? `${new Date(iso).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} (CZASU PL)` : "";