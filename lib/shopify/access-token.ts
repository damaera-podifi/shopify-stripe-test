import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";
import {
  getShopifyAppClientId,
  getShopifyAppClientSecret,
  getShopifyAdminToken,
  getShopifyStoreDomain,
  hasShopifyAppCredentials,
} from "./config";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

const EXPIRY_BUFFER_MS = 60_000;

type ClientCredentialsResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
};

async function fetchClientCredentialsToken(): Promise<string> {
  const domain = getShopifyStoreDomain();
  logCheckout("shopify_token_fetch_start", { domain });

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: getShopifyAppClientId(),
    client_secret: getShopifyAppClientSecret(),
  });

  const response = await fetch(
    `https://${domain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(
      `Shopify client credentials request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
    logCheckoutError("shopify_token_fetch_failed", error, {
      status: response.status,
      detail: detail.slice(0, 500),
    });
    throw error;
  }

  const json = (await response.json()) as ClientCredentialsResponse;
  if (!json.access_token) {
    const error = new Error(
      "Shopify client credentials response missing access_token",
    );
    logCheckoutError("shopify_token_fetch_invalid", error);
    throw error;
  }

  const expiresInMs = (json.expires_in ?? 86_399) * 1000;
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + expiresInMs - EXPIRY_BUFFER_MS,
  };

  logCheckout("shopify_token_fetch_ok", {
    scope: json.scope,
    expiresIn: json.expires_in,
  });

  return json.access_token;
}

export async function getAdminAccessToken(): Promise<string> {
  if (!hasShopifyAppCredentials()) {
    logCheckout("shopify_token_static");
    return getShopifyAdminToken();
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    logCheckout("shopify_token_cache_hit");
    return tokenCache.accessToken;
  }

  return fetchClientCredentialsToken();
}
