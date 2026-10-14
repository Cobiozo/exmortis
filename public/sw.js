/* Service worker exmortis.
   Zasada: nawigacje (HTML) zawsze sieć-najpierw — strona zawsze aktualna, gdy jest sieć.
   Z pamięci korzystamy tylko przy braku sieci. Assety z hashem (/assets/*) — cache-first,
   czcionki (/fonts/*) — stale-while-revalidate. NIGDY nie buforujemy /functions/*, /api/*,
   żądań innych niż GET, adresów z parametrem t= lub tokenem, PayU ani obcych domen
   (media.base44.com z podpisem). */
const VERSION = "exm-2026-10-14";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const FONTS = `${VERSION}-fonts`;
const PAGES = `${VERSION}-pages`;
const KEEP = [SHELL, ASSETS, FONTS, PAGES];
const SHELL_URL = "/";
const OFFLINE_URL = "/offline.html";

// Trasy aplikacji, które mają działać offline z zapisanej kopii (ROZDROŻA, Minutnik ciszy).
const OFFLINE_ROUTES = [/^\/konto\/rozdroza(\/|$)/, /^\/cisza(\/|$)/];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all([
      c.add(new Request(SHELL_URL, { cache: "reload" })).catch(() => {}),
      c.add(new Request(OFFLINE_URL, { cache: "reload" })).catch(() => {}),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
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
    if (res && res.ok && !excluded(url)) {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.put(req, copy)).catch(() => {});
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

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => { if (res && res.ok) cache.put(req, res.clone()).catch(() => {}); return res; })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
