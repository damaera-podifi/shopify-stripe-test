import { cookies } from "next/headers";

export const CART_COOKIE_NAME = "shopify_cart_id";

const CART_MAX_AGE = 60 * 60 * 24 * 30;

export async function getCartIdFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE_NAME)?.value;
}

export async function setCartIdCookie(cartId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CART_MAX_AGE,
    path: "/",
  });
}

export async function clearCartIdCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE_NAME);
}
