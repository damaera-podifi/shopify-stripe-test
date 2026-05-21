import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  buildAuthorizeUrl,
  createPkcePair,
} from "@/lib/shopify/customer-account-auth";

const STATE_COOKIE = "shopify_oauth_state";
const VERIFIER_COOKIE = "shopify_oauth_verifier";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/store/login", request.url));
  }

  try {
    const state = randomBytes(16).toString("hex");
    const { verifier, challenge } = createPkcePair();
    const authorizeUrl = await buildAuthorizeUrl({
      requestUrl: request.url,
      state,
      codeChallenge: challenge,
      loginHint: user.email,
    });

    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    cookieStore.set(VERIFIER_COOKIE, verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify link failed";
    return NextResponse.redirect(
      new URL(`/store?pricing_error=${encodeURIComponent(message)}`, request.url),
    );
  }
}
