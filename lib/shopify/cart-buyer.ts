import type { SessionUser } from "@/lib/auth/types";
import { getCartIdFromCookie } from "./cart-cookie";
import { storefrontMutation } from "./storefront";

/**
 * Associates the cart with the logged-in user (email on buyer identity).
 * Segment automatic discounts on the Storefront cart still require a
 * Customer Account API access token when the shop uses new customer accounts.
 */
export async function syncCartBuyerIdentity(user: SessionUser): Promise<void> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) return;

  const mutation = `#graphql
    mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          id
        }
        userErrors {
          message
        }
      }
    }
  `;

  const buyerIdentity: {
    email: string;
    customerAccessToken?: string;
  } = { email: user.email };

  if (user.shopifyStorefrontAccessToken) {
    buyerIdentity.customerAccessToken = user.shopifyStorefrontAccessToken;
  }

  const data = await storefrontMutation<{
    cartBuyerIdentityUpdate: {
      cart: { id: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(mutation, {
    cartId,
    buyerIdentity,
  });

  const errors = data.cartBuyerIdentityUpdate.userErrors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
}
