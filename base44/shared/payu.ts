// Wspólna obsługa PayU: autoryzacja OAuth, tworzenie zamówienia i mapowanie statusów.
// Wersja bliźniacza: supabase/functions/_shared/payu.ts — zmiany wprowadzać w obu plikach.

export const PAYU_BASE_URLS = {
  secure: "https://secure.payu.com",
  sandbox: "https://secure.snd.payu.com",
};

export function payuBase(env) {
  return PAYU_BASE_URLS[env === "sandbox" ? "sandbox" : "secure"];
}

const TIMEOUT = 15000;

function netError(e, fallback) {
  const name = String(e?.name || "");
  return name === "TimeoutError" || name === "AbortError" ? `${fallback}_TIMEOUT` : `${fallback}_NETWORK`;
}

// OAuth2 PayU: client_credentials w formacie application/x-www-form-urlencoded.
export async function payuToken(payu, { timeoutMs = TIMEOUT } = {}) {
  const base = payuBase(payu?.env);
  const oauthBody = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: String(payu?.clientId || ""),
    client_secret: String(payu?.clientSecret || ""),
  });

  let tokenRes;
  try {
    tokenRes = await fetch(`${base}/pl/standard/user/oauth/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: oauthBody.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(netError(e, "PAYU_OAUTH"));
  }

  const raw = await tokenRes.text().catch(() => "");
  let token = null;
  try {
    token = raw ? JSON.parse(raw) : null;
  } catch {
    token = null;
  }

  if (!tokenRes.ok || !token?.access_token) {
    throw new Error("PAYU_OAUTH_FAILED");
  }
  return { accessToken: String(token.access_token), expiresIn: Number(token.expires_in) || 0 };
}

// POST /api/v2_1/orders. PayU odpowiada 302 z treścią JSON — to nie jest błąd.
export async function payuCreateOrder(payu, accessToken, payload, { timeoutMs = 20000 } = {}) {
  const base = payuBase(payu?.env);

  let orderRes;
  try {
    orderRes = await fetch(`${base}/api/v2_1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(netError(e, "PAYU_CREATE_ORDER"));
  }

  const raw = await orderRes.text().catch(() => "");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("PAYU_INVALID_RESPONSE");
  }

  const statusCode =
    data?.status?.statusCode ||
    (typeof data?.status === "string" ? data.status : "");

  if (
    ![200, 201, 302].includes(orderRes.status) ||
    !data?.orderId ||
    !data?.redirectUri ||
    (statusCode && String(statusCode).toUpperCase() !== "SUCCESS")
  ) {
    const detail = data?.status?.statusDesc || data?.error?.message || "";
    const err = new Error("PAYU_CREATE_ORDER_FAILED");
    err.detail = String(detail).slice(0, 200);
    err.payuStatus = String(orderRes.status);
    throw err;
  }

  return {
    payuOrderId: String(data.orderId),
    redirectUri: String(data.redirectUri),
    payuStatus: "PENDING",
  };
}

// GET /api/v2_1/orders/{orderId} — stan zamówienia w PayU (do ręcznego wznowienia realizacji).
// Zwraca pierwszy obiekt z „orders” (status, totalAmount, currencyCode, merchantPosId, extOrderId).
export async function payuGetOrder(payu, accessToken, payuOrderId, { timeoutMs = 15000 } = {}) {
  const base = payuBase(payu?.env);
  let res;
  try {
    res = await fetch(`${base}/api/v2_1/orders/${encodeURIComponent(String(payuOrderId))}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(netError(e, "PAYU_GET_ORDER"));
  }
  const data = await res.json().catch(() => null);
  const order = Array.isArray(data?.orders) ? data.orders[0] : null;
  if (!res.ok || !order) throw new Error("PAYU_GET_ORDER_FAILED");
  return order;
}

// Status PayU → status zamówienia w bazie. Realizacja idzie osobno (kolumna fulfilled_at).
export function localPayuStatus(payuStatus) {
  const s = String(payuStatus || "").toUpperCase();
  if (s === "COMPLETED") return "COMPLETED";
  if (["CANCELED", "CANCELLED", "REJECTED", "DECLINED", "EXPIRED"].includes(s)) return "CANCELED";
  // NEW, PENDING, WAITING_FOR_CONFIRMATION i wszystko nieznane: płatność jeszcze się nie dokonała.
  return "PENDING";
}