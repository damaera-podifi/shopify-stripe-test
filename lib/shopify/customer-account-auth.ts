import { createHash, randomBytes } from "node:crypto";
import { getShopifyStoreDomain } from "./config";

type OpenIdConfig = {
  authorization_endpoint: string;
  token_endpoint: string;
};

type CustomerAccountApiConfig = {
  graphql_api: string;
};

function getCustomerAccountClientId(): string {
  const id = process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID?.trim();
  if (!id) {
    throw new Error(
      "Missing SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID (Headless channel → Customer Account API)",
    );
  }
  return id;
}

export function getShopifyCallbackUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.origin}/api/auth/shopify/callback`;
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export async function getOpenIdConfig(): Promise<OpenIdConfig> {
  const domain = getShopifyStoreDomain();
  const response = await fetch(
    `https://${domain}/.well-known/openid-configuration`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("Failed to load Customer Account OpenID configuration");
  }
  return response.json() as Promise<OpenIdConfig>;
}

export async function getCustomerAccountGraphqlUrl(): Promise<string> {
  const domain = getShopifyStoreDomain();
  const response = await fetch(
    `https://${domain}/.well-known/customer-account-api`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("Failed to load Customer Account API configuration");
  }
  const json = (await response.json()) as CustomerAccountApiConfig;
  if (!json.graphql_api) {
    throw new Error("Customer Account API graphql endpoint missing");
  }
  return json.graphql_api;
}

export async function buildAuthorizeUrl(input: {
  requestUrl: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): Promise<string> {
  const openId = await getOpenIdConfig();
  const params = new URLSearchParams({
    scope: "openid email customer-account-api:full",
    client_id: getCustomerAccountClientId(),
    response_type: "code",
    redirect_uri: getShopifyCallbackUrl(input.requestUrl),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  if (input.loginHint) {
    params.set("login_hint", input.loginHint);
  }
  return `${openId.authorization_endpoint}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(input: {
  requestUrl: string;
  code: string;
  codeVerifier: string;
}): Promise<{ accessToken: string; expiresIn?: number }> {
  const openId = await getOpenIdConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getCustomerAccountClientId(),
    redirect_uri: getShopifyCallbackUrl(input.requestUrl),
    code: input.code,
    code_verifier: input.codeVerifier,
  });

  const response = await fetch(openId.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "shopify-try/1.0",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(
      json.error_description ?? json.error ?? "Token exchange failed",
    );
  }

  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
  };
}

export async function createStorefrontCustomerAccessToken(
  customerAccountAccessToken: string,
): Promise<{ accessToken: string; expiresAt?: string }> {
  const graphqlUrl = await getCustomerAccountGraphqlUrl();
  const mutation = `#graphql
    mutation StorefrontCustomerAccessTokenCreate {
      storefrontCustomerAccessTokenCreate {
        customerAccessToken
        userErrors {
          field
          message
        }
      }
    }
  `;

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: customerAccountAccessToken,
      "User-Agent": "shopify-try/1.0",
    },
    body: JSON.stringify({ query: mutation }),
    cache: "no-store",
  });

  const json = (await response.json()) as {
    data?: {
      storefrontCustomerAccessTokenCreate?: {
        customerAccessToken?: string;
        userErrors?: Array<{ message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(", "));
  }

  const payload = json.data?.storefrontCustomerAccessTokenCreate;
  const errors = payload?.userErrors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  const accessToken = payload?.customerAccessToken;
  if (!accessToken) {
    throw new Error("No storefront customer access token returned");
  }

  return { accessToken };
}
