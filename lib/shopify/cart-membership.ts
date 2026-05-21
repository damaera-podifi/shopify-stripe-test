import { cache } from "react";
import { getStoreSession } from "@/lib/auth/session";
import { logCheckout } from "@/lib/checkout/logger";
import { getCartIdFromCookie } from "./cart-cookie";
import { syncMembershipCustomerForSession } from "./membership-sync-cache";
import { storefrontMutation } from "./storefront";

export type CartBuyerIdentity = {
  email: string;
};

async function resolveBuyerIdentity(): Promise<CartBuyerIdentity | null> {
  const session = await getStoreSession();
  if (!session) {
    return null;
  }

  return { email: session.email };
}

export async function buyerIdentityInputForSession(): Promise<CartBuyerIdentity | null> {
  return resolveBuyerIdentity();
}

const ensureCartBuyerIdentity = cache(
  async (cartId: string, buyerIdentity: CartBuyerIdentity, sessionEmail: string) => {
    const mutation = `#graphql
    mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart {
          id
          buyerIdentity {
            email
            customer {
              id
            }
          }
        }
        userErrors {
          message
        }
      }
    }
  `;

    const data = await storefrontMutation<{
      cartBuyerIdentityUpdate: {
        cart: {
          id: string;
          buyerIdentity: {
            email: string | null;
            customer: { id: string } | null;
          };
        } | null;
        userErrors: Array<{ message: string }>;
      };
    }>(mutation, {
      cartId,
      buyerIdentity,
    });

    const errors = data.cartBuyerIdentityUpdate.userErrors;
    if (errors.length) {
      throw new Error(errors.map((error) => error.message).join(", "));
    }

    logCheckout("cart_buyer_identity_sync_ok", {
      cartId,
      email: sessionEmail,
      linkedCustomerId:
        data.cartBuyerIdentityUpdate.cart?.buyerIdentity.customer?.id ?? null,
    });
  },
);

export async function syncCartForActiveSession(): Promise<void> {
  const [session, cartId, buyerIdentity] = await Promise.all([
    getStoreSession(),
    getCartIdFromCookie(),
    resolveBuyerIdentity(),
  ]);

  if (!session || !cartId || !buyerIdentity) {
    return;
  }

  await syncMembershipCustomerForSession(
    session.email,
    session.isMembershipActive,
  );

  await ensureCartBuyerIdentity(cartId, buyerIdentity, session.email);

  logCheckout("cart_session_sync_ok", {
    cartId,
    email: session.email,
    isMembershipActive: session.isMembershipActive,
  });
}
