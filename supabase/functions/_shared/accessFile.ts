// Plik z dostępu klienta: PDF z osobistym znakiem wodnym (e-mail, numer zamówienia, licencja) albo inny plik prywatny.
// Wspólne dla konta (myAccount) i linku z zamówienia bez konta (orderAccess). Zwraca odpowiedź { url, name } albo błąd.
import { runSql, escStr } from "./supabase.ts";
import { personalizePdf, newLicenseId, WM_VERSION } from "./pdfLicense.ts";
import { loadAppUrl } from "./settings.ts";

// Link z magazynu Supabase → adres strony (25.11.2026): exmortis.pl/functions/plik?p=…&token=… — server.js przekazuje
// /functions/* do funkcji „plik”, która oddaje plik z podpisanego linku. Klient nie widzi adresu magazynu.
// url — do czytania/odtwarzania (inline); download_url — ten sam plik z nagłówkiem „zapisz jako” pod podaną nazwą.
async function siteLinks(base44, signed: string, name: string) {
  const m = String(signed).match(/^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/sign\/([^?]+)\?token=([^&]+)/);
  // Nagrania (audio/wideo) zostają na bezpośrednim linku: odtwarzacz przewija je fragmentami, a serwer strony
  // przekazuje pliki w całości (duże nagrania byłyby wolne). Przez exmortis.pl idą dokumenty (PDF, ZIP itp.).
  if (!m || /\.(mp3|m4a|aac|wav|ogg|mp4|m4v|webm|mov)$/i.test(decodeURIComponent(m[1]))) {
    const sep = String(signed).includes("?") ? "&" : "?";
    return { url: signed, download_url: `${signed}${sep}download=${encodeURIComponent(name)}`, name };
  }
  const app = (await loadAppUrl(base44).catch(() => "")) || "https://exmortis.pl";
  const url = `${app}/functions/plik?p=${encodeURIComponent(decodeURIComponent(m[1])).replace(/%2F/g, "/")}&token=${m[2]}`;
  return { url, download_url: `${url}&d=${encodeURIComponent(name)}`, name };
}

export async function accessFileResponse(base44, a, ip: string, email: string) {
  const rows = await runSql(
    base44,
    `SELECT name, price::float8 AS price, product_type, private_file_uri, private_file_name, file_url FROM public.products WHERE id::text = ${escStr(a.product_id)} LIMIT 1`,
    true
  );
  const p = rows[0];
  // Każdy PDF (kupiony i darmowy) dostaje osobistą kopię ze znakiem wodnym (e-mail konta).
  // Zestaw (ebook + nagrania): plik produktu to zawsze ebook PDF — z tym samym znakiem wodnym.
  const pdfSrc = p?.product_type === "pdf" || p?.product_type === "zestaw" ? (p.private_file_uri || (/\.pdf(\?|$)/i.test(String(p.file_url || "")) ? p.file_url : null)) : null;
  if (pdfSrc) {
    const sr = base44.asServiceRole;
    const orderNo = a.order_id ? String(a.order_id).slice(0, 8).toUpperCase() : "R-" + a.id.slice(-6).toUpperCase();
    let lic = (await sr.entities.License.filter({ access_id: a.id }))[0];
    const srcKey = `${pdfSrc}#${WM_VERSION}`;
    if (!lic || lic.source_uri !== srcKey || !lic.file_uri) {
      const { signed_url } = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: pdfSrc, expires_in: 120 });
      const orig = new Uint8Array(await (await fetch(signed_url)).arrayBuffer());
      const licenseId = lic?.license_id || newLicenseId();
      const out = await personalizePdf(orig, {
        email: a.user_email, orderNo, licenseId, title: p.name,
        date: (a.valid_from || a.created_date || "").slice(0, 10),
      });
      const { file_uri } = await sr.integrations.Core.UploadPrivateFile({
        file: new File([out], `${crypto.randomUUID()}.pdf`, { type: "application/pdf" }),
      });
      const data = { license_id: licenseId, access_id: a.id, user_email: a.user_email, product_id: a.product_id, product_name: p.name, order_id: a.order_id || "", file_uri, source_uri: srcKey };
      if (lic) { await sr.entities.License.update(lic.id, data); lic = { ...lic, ...data }; }
      else lic = await sr.entities.License.create({ ...data, downloads: 0 });
    }
    await sr.entities.License.update(lic.id, { downloads: (lic.downloads || 0) + 1 });
    await sr.entities.SecurityLog.create({ type: "pdf", user_email: email, ip: ip, details: `${p.name} · ${lic.license_id}` });
    const { signed_url } = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: lic.file_uri, expires_in: 600 });
    const safe = String(p.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    return Response.json({ ...(await siteLinks(base44, signed_url, `${safe}_exmortis_${orderNo}.pdf`)), title: p.name });
  }
  if (p?.private_file_uri) {
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: p.private_file_uri,
      expires_in: 600,
    });
    return Response.json({ ...(await siteLinks(base44, signed_url, p.private_file_name || "plik")), title: p.name });
  }
  if (p?.file_url) return Response.json({ url: p.file_url, download_url: p.file_url, name: "plik" });
  return Response.json({ error: "Plik nie jest jeszcze gotowy" }, { status: 404 });
}