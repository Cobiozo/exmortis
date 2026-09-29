// Pomocnicze funkcje YouTube: wyciąganie ID filmu i adres miniatury.

// Obsługuje: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...,
// music.youtube.com/watch?v=..., youtube.com/embed|live|v/... oraz linki
// z dodatkowymi parametrami (&t=, &list= itp.). Przyjmuje też samo ID.
export function extractVideoId(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/youtu\.be\/([\w-]{11})/i);
  if (m) return m[1];
  m = s.match(/youtube(?:-nocookie)?\.com\/shorts\/([\w-]{11})/i);
  if (m) return m[1];
  m = s.match(/[?&]v=([\w-]{11})/i);
  if (m) return m[1];
  m = s.match(/youtube(?:-nocookie)?\.com\/(?:embed|live|v)\/([\w-]{11})/i);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(s)) return s;
  return null;
}

export const thumbUrl = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;