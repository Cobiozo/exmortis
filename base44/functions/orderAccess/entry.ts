import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { clientIp, emailField, escStr, runSql } from "../../shared/supabase.ts";
import { ipAllowed, TOO_MANY } from "../../shared/rateLimit.ts";
import { accessFilter } from "../../shared/mirror.ts";
import { isActive } from "../../shared/access.ts";
import { accessFileResponse } from "../../shared/accessFile.ts";
import { linkByToken, orderMaterials, hasAccount, activateAccount, issueBuyerCode, resendLinks, hasPaidOrder } from "../../shared/orderLinks.ts";

// Materiały z zamówienia bez konta (/pobierz#t=…): podgląd, pobranie pliku, „Aktywuj konto”, nowy link mailem.
// Token z linku jest jedynym kluczem — odpowiedzi nie zawierają pełnego adresu e-mail.
const mask = (e: string) => String(e).replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c);
const first = (n: unknown) => String(n || "").trim().split(/\s+/)[0].slice(0, 40);
const LINK_GONE = "Ten link jest nieprawidłowy. Poproś o nowy — przyjdzie na adres z zamówienia.";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ip = clientIp(req);
    const action = String(body.action || "");

    if (action === "info") {
      const link = await linkByToken(base44, body.t);
      if (!link) return Response.json({ error: LINK_GONE, gone: true }, { status: 404 });
      if (!link.paid) return Response.json({ pending: true });
      const materials = await orderMaterials(base44, link.items);
      return Response.json({
        name: first(link.buyer_name), email: mask(link.email), order: String(link.order_id).slice(0, 8).toUpperCase(),
        expires_at: link.expires_at, expired: !!link.expired, can_activate: !link.too_old,
        account: await hasAccount(base44, link.email), materials,
      });
    }

    if (action === "file") {
      if (!(await ipAllowed(base44, ip, "pobierz", 40, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
      const link = await linkByToken(base44, body.t);
      if (!link || !link.paid) return Response.json({ error: LINK_GONE }, { status: 404 });
      if (link.expired) return Response.json({ error: "Link wygasł. Poproś o nowy — przyjdzie na adres z zamówienia.", expired: true }, { status: 410 });
      const pid = String(body.product_id || "");
      const m = (await orderMaterials(base44, link.items)).find((x) => x.id === pid);
      if (!m) return Response.json({ error: "Tego materiału nie ma w zamówieniu" }, { status: 404 });
      if (m.account_only) return Response.json({ error: "Kurs jest dostępny na koncie — użyj przycisku „Aktywuj dostęp”." }, { status: 400 });
      const a = (await accessFilter(base44, { user_email: String(link.email).toLowerCase(), product_id: pid }))[0];
      if (!a || !isActive(a)) return Response.json({ error: "Dostęp do tego materiału wygasł lub został cofnięty. Napisz do mnie — wyjaśnię." }, { status: 403 });
      await runSql(base44, `UPDATE public.order_links SET downloads = downloads + 1, last_download_at = now() WHERE token_hash = ${escStr(link.token_hash)}`).catch(() => {});
      return await accessFileResponse(base44, a, ip, String(link.email).toLowerCase());
    }

    if (action === "activate") {
      if (!(await ipAllowed(base44, ip, "aktywuj", 10, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
      const link = await linkByToken(base44, body.t);
      if (!link || !link.paid) return Response.json({ error: LINK_GONE }, { status: 404 });
      if (link.too_old) return Response.json({ error: "Link do aktywacji wygasł. Załóż konto na stronie rejestracji tym samym adresem — zakupy pojawią się same.", expired: true }, { status: 410 });
      // Istniejące konto: bez logowania z linku (link z maila nie zastępuje hasła do konta, które już było).
      if (await hasAccount(base44, link.email)) return Response.json({ exists: true });
      const r = await activateAccount(base44, link.email, String(link.buyer_name || ""));
      let code = null;
      if (r.created && (await hasPaidOrder(base44, link.email))) code = await issueBuyerCode(base44, link.email).catch(() => null);
      return Response.json({ token_hash: r.token_hash, created: r.created, code: code ? { value: 20, until: code.until } : null });
    }

    if (action === "resend") {
      if (!(await ipAllowed(base44, ip, "pobierz_link", 5, 3600000))) return Response.json({ error: TOO_MANY }, { status: 429 });
      if (body.t) {
        const link = await linkByToken(base44, body.t);
        if (link && link.paid) await resendLinks(base44, { orderId: String(link.order_id) });
      } else {
        const email = emailField(body);
        await resendLinks(base44, { email });
      }
      // Ta sama odpowiedź niezależnie od wyniku — bez sprawdzania, czy adres ma zamówienia.
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Nieznana akcja" }, { status: 400 });
  } catch (error) {
    console.error("orderAccess:", String(error?.message || error).slice(0, 300));
    if (error && error.isValidation) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ error: "Coś poszło nie tak. Spróbuj za chwilę albo napisz do mnie." }, { status: 500 });
  }
}
