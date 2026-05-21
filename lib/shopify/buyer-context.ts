import { getSessionUser } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users-db";

export type BuyerContext = {
  customerAccessToken: string;
  email: string;
};

/** Storefront buyer token for @inContext pricing (new customer accounts). */
export async function getBuyerContext(): Promise<BuyerContext | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const user = await findUserById(session.id);
  if (!user?.shopifyStorefrontAccessToken) return null;

  if (user.shopifyStorefrontTokenExpiresAt) {
    const expires = Date.parse(user.shopifyStorefrontTokenExpiresAt);
    if (Number.isFinite(expires) && expires < Date.now()) {
      return null;
    }
  }

  return {
    customerAccessToken: user.shopifyStorefrontAccessToken,
    email: user.email,
  };
}
