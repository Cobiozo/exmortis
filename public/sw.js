/* Service worker exmortis.
   Zasada: nawigacje (HTML) zawsze sieć-najpierw — strona zawsze aktualna, gdy jest sieć.
   Z pamięci korzystamy tylko przy braku sieci. Assety z hashem (/assets/*) — cache-first,
   czcionki (/fonts/*) — stale-while-revalidate. NIGDY nie buforujemy /functions/*, /api/*,
   żądań innych niż GET, adresów z parametrem t= lub tokenem, PayU ani obcych domen
   (media.base44.com z podpisem).

   Wersja: brana z adresu skryptu (/sw.js?v=<hash z index.html>). Hash zmienia się przy każdej
   publikacji, więc nowa wersja workera instaluje się sama — bez zmiany vite.config.js. */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `exm-${VERSION}-shell`;
const ASSETS = `exm-${VERSION}-assets`;
const FONTS = `exm-${VERSION}-fonts`;
const PAGES = `exm-${VERSION}-pages`;
const KEEP = [SHELL, ASSETS, FONTS, PAGES];
const LIMIT = { [ASSETS]: 120, [PAGES]: 20, [FONTS]: 40 };
const SHELL_URL = "/";
const OFFLINE_URL = "/offline.html";

// Trasy aplikacji, które mają działać offline z zapisanej kopii (ROZDROŻA, Minutnik ciszy).
const OFFLINE_ROUTES = [/^\/konto\/rozdroza(\/|$)/, /^\/cisza(\/|$)/];

// Do pamięci trafiają wyłącznie własne, udane odpowiedzi — nigdy błędy, przekierowania
// ani odpowiedzi „opaque" (z obcych domen).
function cacheable(res) {
  return !!res && res.ok && res.type === "basic" && !res.redirected;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const shellRes = await fetch(SHELL_URL, { cache: "reload" });
      if (cacheable(shellRes)) {
        const html = await shellRes.clone().text();
        await (await caches.open(SHELL)).put(SHELL_URL, shellRes.clone());
        await precache(html);
      }
      const offRes = await fetch(OFFLINE_URL, { cache: "reload" }).catch(() => null);
      if (cacheable(offRes)) await (await caches.open(SHELL)).put(OFFLINE_URL, offRes.clone());
    } catch { /* bez wstępnego dobrania */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("exm-") && !KEEP.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Czego nie wolno zapisywać ani dotykać.
function excluded(url) {
  const p = url.pathname;
  return (
    p.startsWith("/functions/") ||
    p.startsWith("/api/") ||
    p.startsWith("/admin") ||
    p.startsWith("/skaner") ||
    p.startsWith("/konto") ||
    url.searchParams.has("t") ||
    url.searchParams.has("token") ||
    /payu/i.test(url.href)
  );
}

// Wstępne dobranie plików wskazanych przez index.html (skrypty, style, czcionki, logo).
// Dzięki temu po instalacji aplikacja ma w pamięci wszystko, co potrzebne do startu offline.
async function precache(html) {
  const refs = new Set();
  const re = /(?:href|src)="(\/[^"?#]+\.(?:js|css|woff2|woff|webp|png|jpg|jpeg|svg))"/g;
  let m;
  while ((m = re.exec(html))) refs.add(m[1]);
  await Promise.all([...refs].map(async (p) => {
    if (p.startsWith("/functions/") || p.startsWith("/api/")) return;
    const name = p.startsWith("/assets/") ? ASSETS : p.startsWith("/fonts/") ? FONTS : SHELL;
    const c = await caches.open(name);
    if (await c.match(p)) return;
    const res = await fetch(p, { cache: "reload" }).catch(() => null);
    if (cacheable(res)) await c.put(p, res.clone());
  }));
  await trim(ASSETS, LIMIT[ASSETS]);
  await trim(FONTS, LIMIT[FONTS]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.get("range")) return; // wznawianie pobierania (audio/wideo) zostawiamy sieci
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // obce zasoby (m.in. media.base44.com) zostawiamy sieci

  if (req.mode === "navigate") {
    event.respondWith(handleNavigate(req, url));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req, ASSETS));
    return;
  }
  if (url.pathname.startsWith("/fonts/")) {
    event.respondWith(staleWhileRevalidate(req, FONTS));
  }
});

async function handleNavigate(req, url) {
  try {
    const res = await fetch(req);
    if (cacheable(res) && !excluded(url)) {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, LIMIT[PAGES])).catch(() => {});
    }
    return res;
  } catch {
    // Bez sieci: najpierw dokładna kopia strony (jeśli była zapisana),
    // potem — dla ROZDROŻ/Minutnika — powłoka aplikacji, na końcu strona offline.
    const exact = await caches.match(req);
    if (exact) return exact;
    if (OFFLINE_ROUTES.some((r) => r.test(url.pathname))) {
      const shell = await caches.match(SHELL_URL);
      if (shell) return shell;
    }
    const off = await caches.match(OFFLINE_URL);
    return off || Response.error();
  }
}

// Pamięć nie rośnie bez końca: po każdej publikacji przybywają nowe pliki z hashem.
async function trim(cacheName, max) {
  try {
    const c = await caches.open(cacheName);
    const keys = await c.keys();
    for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
  } catch { /* bez sprzątania */ }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (cacheable(res)) {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy)).then(() => trim(cacheName, LIMIT[cacheName])).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (cacheable(res)) cache.put(req, res.clone()).then(() => trim(cacheName, LIMIT[cacheName])).catch(() => {});
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
