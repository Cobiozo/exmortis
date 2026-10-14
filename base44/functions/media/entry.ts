import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { clientIp } from '../../shared/supabase.ts';

// Proxy obrazów z prywatnej biblioteki: sprawdza pochodzenie, limit żądań, zwraca wersję WebP z cache przeglądarki.
const ALLOWED = [/^exmortis\.pl$/, /^www\.exmortis\.pl$/, /\.base44\.app$/, /\.base44\.com$/, /^localhost$/];
const WIDTHS = [480, 960, 1600, 2000];
const hits = new Map();
const assets = new Map();

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><rect width="480" height="270" fill="#0A0A0B"/><text x="240" y="142" fill="#C9A24A" font-family="Georgia,serif" font-size="22" text-anchor="middle" letter-spacing="3">© EXMORTIS.PL</text></svg>`;
const deny = (status) => new Response(PLACEHOLDER, { status, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noimageindex, noindex' } });

const hostOk = (u) => { try { const h = new URL(u).hostname; return ALLOWED.some((r) => r.test(h)); } catch { return false; } };

function fromSite(req) {
  const site = req.headers.get('sec-fetch-site');
  const dest = req.headers.get('sec-fetch-dest');
  if (dest === 'document') return false; // otwarte w nowej karcie / wklejone w pasek adresu
  const ref = req.headers.get('referer') || req.headers.get('origin');
  if (site === 'cross-site') return false;
  if (site === 'same-origin' || site === 'same-site') return true;
  return !!ref && hostOk(ref);
}

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60000) {
    if (hits.size > 5000) hits.clear(); // mapa nie rośnie bez końca na długo żyjącej instancji
    hits.set(ip, { t: now, n: 1 });
    return false;
  }
  h.n++;
  return h.n > 300;
}

export default async function (req) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '';
    if (!/^[a-f0-9]{32}$/.test(id)) return deny(404);
    if (!fromSite(req)) return deny(403);
    const ip = clientIp(req);
    if (limited(ip)) return deny(429);

    let a = assets.get(id);
    if (!a || Date.now() - a.t > 300000) {
      const base44 = createClientFromRequest(req);
      const rows = await base44.asServiceRole.entities.MediaAsset.filter({ pub_id: id }, '-created_date', 1);
      const m = rows[0];
      a = { t: Date.now(), m: m && !m.usuniety_at ? m : null };
      assets.set(id, a);
    }
    if (!a.m) return deny(404);
    const want = Math.min(2000, Number(url.searchParams.get('w')) || 960);
    const have = WIDTHS.filter((w) => a.m.warianty?.[w]);
    const pick = have.find((w) => w >= want) || have[have.length - 1];
    if (!pick) return deny(404);

    const base44 = createClientFromRequest(req);
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: a.m.warianty[pick], expires_in: 60 });
    const r = await fetch(signed_url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return deny(502);
    return new Response(r.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=86400',
        'X-Robots-Tag': 'noimageindex, noindex',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Vary': 'Referer, Sec-Fetch-Site',
      },
    });
  } catch (e) {
    return deny(500);
  }
}