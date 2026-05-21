import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { updateUserStorefrontAccessToken } from "@/lib/auth/users-db";
import {
  createStorefrontCustomerAccessToken,
  exchangeAuthorizationCode,
} from "@/lib/shopify/customer-account-auth";
import { syncCartBuyerIdentity } from "@/lib/shopify/cart-buyer";

const STATE_COOKIE = "shopify_oauth_state";
const VERIFIER_COOKIE = "shopify_oauth_verifier";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/store/login", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const verifier = cookieStore.get(VERIFIER_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/store?pricing_error=${encodeURIComponent(oauthError)}`,
        request.url,
      ),
    );
  }

  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(
      new URL("/store?pricing_error=invalid_oauth_state", request.url),
    );
  }

  try {
    const { accessToken: customerAccountToken, expiresIn } =
      await exchangeAuthorizationCode({
        requestUrl: request.url,
        code,
        codeVerifier: verifier,
      });

    const { accessToken: storefrontToken } =
      await createStorefrontCustomerAccessToken(customerAccountToken);

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    await updateUserStorefrontAccessToken(user.id, storefrontToken, expiresAt);

    await syncCartBuyerIdentity({
      ...user,
      shopifyStorefrontAccessToken: storefrontToken,
    }).catch(() => {});

    return NextResponse.redirect(new URL("/store?pricing_linked=1", request.url));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify link failed";
    return NextResponse.redirect(
      new URL(`/store?pricing_error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
