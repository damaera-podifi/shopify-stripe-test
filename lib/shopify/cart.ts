import { getTrackedSegmentIds } from "@/lib/auth/segments";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminMemberPricing } from "./admin-member-pricing";
import {
  clearCartIdCookie,
  getCartIdFromCookie,
  setCartIdCookie,
} from "./cart-cookie";
import { syncCartBuyerIdentity } from "./cart-buyer";
import { injectBuyerInContext } from "./in-context";
import {
  applyMemberDiscountToCart,
  effectiveAdminMemberPricing,
  getMemberPricingContext,
} from "./member-pricing";
import { storefrontMutation, storefrontQuery } from "./storefront";

export type CartMoney = {
  amount: string;
  currencyCode: string;
};

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: CartMoney;
    compareAtPrice?: CartMoney | null;
    image: { url: string; altText: string | null } | null;
    product: {
      title: string;
      handle: string;
    };
  };
};

export type CartDiscountAllocation = {
  discountedAmount: CartMoney;
  title?: string;
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: CartMoney;
    totalAmount: CartMoney;
  };
  discountAllocations: CartDiscountAllocation[];
  lines: CartLine[];
};

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      amount
      currencyCode
    }
    totalAmount {
      amount
      currencyCode
    }
  }
  discountAllocations {
    discountedAmount {
      amount
      currencyCode
    }
    ... on CartAutomaticDiscountAllocation {
      title
    }
    ... on CartCodeDiscountAllocation {
      code
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
            image {
              url
              altText
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
`;

type CartPayload = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: Cart["cost"];
  discountAllocations?: CartDiscountAllocation[];
  lines: { edges: Array<{ node: CartLine }> };
};

function normalizeCart(cart: CartPayload | null | undefined): Cart | null {
  if (!cart) return null;

  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    discountAllocations: cart.discountAllocations ?? [],
    lines: cart.lines.edges.map((edge) => edge.node),
  };
}

async function resolveMemberPricingForCart() {
  const user = await getSessionUser();
  const segmentPricing =
    user && getTrackedSegmentIds().length > 0
      ? await getAdminMemberPricing({
          email: user.email,
          shopifyCustomerId: user.shopifyCustomerId,
        }).catch(() => null)
      : null;
  const adminMemberPricing = effectiveAdminMemberPricing(user, segmentPricing);
  return getMemberPricingContext(user, adminMemberPricing);
}

async function applyMemberPricingToCart(
  cart: Cart | null,
): Promise<Cart | null> {
  if (!cart) return null;
  const pricing = await resolveMemberPricingForCart();
  if (!pricing.isMember || pricing.discountPercent === null) {
    return cart;
  }
  return applyMemberDiscountToCart(cart, pricing);
}

async function syncBuyerIfLoggedIn() {
  const user = await getSessionUser();
  if (!user) return;
  await syncCartBuyerIdentity(user).catch(() => {});
}

function getUserErrors(
  userErrors: Array<{ message: string }> | undefined,
): string | null {
  if (!userErrors?.length) return null;
  return userErrors.map((e) => e.message).join(", ");
}

export async function getCart(): Promise<Cart | null> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) return null;

  await syncBuyerIfLoggedIn();

  const user = await getSessionUser();
  let query = `#graphql
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ${CART_FIELDS}
      }
    }
  `;

  if (user?.shopifyStorefrontAccessToken) {
    query = injectBuyerInContext(query, user.shopifyStorefrontAccessToken);
  }

  try {
    const data = await storefrontQuery<{ cart: CartPayload | null }>(
      query,
      { cartId },
      { revalidate: false },
    );
    const cart = normalizeCart(data.cart);
    return applyMemberPricingToCart(cart);
  } catch {
    await clearCartIdCookie();
    return null;
  }
}

async function persistCart(cart: CartPayload | null | undefined) {
  const normalized = normalizeCart(cart);
  if (!normalized) {
    throw new Error("Cart operation failed");
  }
  await setCartIdCookie(normalized.id);
  return normalized;
}

export async function createCart(
  merchandiseId: string,
  quantity: number,
): Promise<Cart> {
  const mutation = `#graphql
    mutation CartCreate($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          message
        }
      }
    }
  `;

  const data = await storefrontMutation<{
    cartCreate: {
      cart: CartPayload | null;
      userErrors: Array<{ message: string }>;
    };
  }>(mutation, {
    lines: [{ merchandiseId, quantity }],
  });

  const error = getUserErrors(data.cartCreate.userErrors);
  if (error) throw new Error(error);

  const cart = await persistCart(data.cartCreate.cart);
  await syncBuyerIfLoggedIn();
  return (await applyMemberPricingToCart(cart)) ?? cart;
}

export async function addToCart(
  merchandiseId: string,
  quantity: number,
): Promise<Cart> {
  const cartId = await getCartIdFromCookie();

  if (!cartId) {
    return createCart(merchandiseId, quantity);
  }

  const mutation = `#graphql
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          message
        }
      }
    }
  `;

  const data = await storefrontMutation<{
    cartLinesAdd: {
      cart: CartPayload | null;
      userErrors: Array<{ message: string }>;
    };
  }>(mutation, {
    cartId,
    lines: [{ merchandiseId, quantity }],
  });

  const error = getUserErrors(data.cartLinesAdd.userErrors);
  if (error) throw new Error(error);

  const cart = await persistCart(data.cartLinesAdd.cart);
  await syncBuyerIfLoggedIn();
  return (await applyMemberPricingToCart(cart)) ?? cart;
}

export async function updateCartLine(
  lineId: string,
  quantity: number,
): Promise<Cart> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) throw new Error("No cart found");

  const mutation = `#graphql
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          message
        }
      }
    }
  `;

  const data = await storefrontMutation<{
    cartLinesUpdate: {
      cart: CartPayload | null;
      userErrors: Array<{ message: string }>;
    };
  }>(mutation, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });

  const error = getUserErrors(data.cartLinesUpdate.userErrors);
  if (error) throw new Error(error);

  const cart = await persistCart(data.cartLinesUpdate.cart);
  await syncBuyerIfLoggedIn();
  return (await applyMemberPricingToCart(cart)) ?? cart;
}

export async function removeCartLine(lineId: string): Promise<Cart | null> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) return null;

  const mutation = `#graphql
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          message
        }
      }
    }
  `;

  const data = await storefrontMutation<{
    cartLinesRemove: {
      cart: CartPayload | null;
      userErrors: Array<{ message: string }>;
    };
  }>(mutation, {
    cartId,
    lineIds: [lineId],
  });

  const error = getUserErrors(data.cartLinesRemove.userErrors);
  if (error) throw new Error(error);

  const cart = normalizeCart(data.cartLinesRemove.cart);
  if (!cart || cart.totalQuantity === 0) {
    await clearCartIdCookie();
  }

  return cart;
}
