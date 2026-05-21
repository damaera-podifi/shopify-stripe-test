import { unstable_cache } from "next/cache";
import {
  clearCartIdCookie,
  getCartIdFromCookie,
  setCartIdCookie,
} from "./cart-cookie";
import {
  buyerIdentityInputForSession,
  syncCartForActiveSession,
} from "./cart-membership";
import { getStoreSession } from "@/lib/auth/session";
import { logCheckoutError } from "@/lib/checkout/logger";
import { storefrontMutation, storefrontQuery } from "./storefront";

export const STORE_CART_CACHE_TAG = "store-cart";

export type CartMoney = {
  amount: string;
  currencyCode: string;
};

export type CartDiscountAllocation = {
  discountedAmount: CartMoney;
  title: string;
};

export type CartLine = {
  id: string;
  quantity: number;
  cost: {
    subtotalAmount: CartMoney;
    totalAmount: CartMoney;
  };
  discountAllocations: CartDiscountAllocation[];
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    price: CartMoney;
    image: { url: string; altText: string | null } | null;
    product: {
      title: string;
      handle: string;
    };
  };
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: CartMoney;
    totalAmount: CartMoney;
  };
  discountTotal: CartMoney | null;
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
  lines(first: 50) {
    edges {
      node {
        id
        quantity
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

type CartLinePayload = Omit<CartLine, "discountAllocations"> & {
  discountAllocations: Array<{
    discountedAmount: CartMoney;
    title?: string;
    code?: string;
  }>;
};

type CartPayload = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: Cart["cost"];
  lines: { edges: Array<{ node: CartLinePayload }> };
};

function normalizeDiscountAllocations(
  allocations: CartLinePayload["discountAllocations"],
): CartDiscountAllocation[] {
  return allocations.map((allocation) => ({
    discountedAmount: allocation.discountedAmount,
    title: allocation.title ?? allocation.code ?? "Discount",
  }));
}

function normalizeCart(cart: CartPayload | null | undefined): Cart | null {
  if (!cart) return null;

  const subtotal = Number(cart.cost.subtotalAmount.amount);
  const total = Number(cart.cost.totalAmount.amount);
  const discountAmount = Math.max(0, subtotal - total);

  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    totalQuantity: cart.totalQuantity,
    cost: cart.cost,
    discountTotal:
      discountAmount > 0
        ? {
            amount: discountAmount.toFixed(2),
            currencyCode: cart.cost.totalAmount.currencyCode,
          }
        : null,
    lines: cart.lines.edges.map((edge) => ({
      ...edge.node,
      discountAllocations: normalizeDiscountAllocations(
        edge.node.discountAllocations,
      ),
    })),
  };
}

function getUserErrors(
  userErrors: Array<{ message: string }> | undefined,
): string | null {
  if (!userErrors?.length) return null;
  return userErrors.map((e) => e.message).join(", ");
}

async function cartCreateInput(
  lines: Array<{ merchandiseId: string; quantity: number }>,
) {
  const buyerIdentity = await buyerIdentityInputForSession();

  return {
    lines: lines.map((line) => ({
      merchandiseId: line.merchandiseId,
      quantity: line.quantity,
    })),
    ...(buyerIdentity ? { buyerIdentity } : {}),
  };
}

async function fetchCartQuantityById(cartId: string): Promise<number> {
  const query = `#graphql
    query CartQuantity($cartId: ID!) {
      cart(id: $cartId) {
        totalQuantity
      }
    }
  `;

  const data = await storefrontQuery<{ cart: { totalQuantity: number } | null }>(
    query,
    { cartId },
    { cache: "no-store" },
  );

  return data.cart?.totalQuantity ?? 0;
}

const getCachedCartQuantity = (cartId: string) =>
  unstable_cache(
    () => fetchCartQuantityById(cartId),
    ["store-cart-quantity", cartId],
    { tags: [STORE_CART_CACHE_TAG, `${STORE_CART_CACHE_TAG}:${cartId}`] },
  );

/** Lightweight cart count for the store header (no membership sync). */
export async function getCartQuantity(): Promise<number> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) return 0;

  try {
    return await getCachedCartQuantity(cartId)();
  } catch {
    await clearCartIdCookie();
    return 0;
  }
}

export async function getCart(): Promise<Cart | null> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) return null;

  try {
    await syncCartForActiveSession();
  } catch (error) {
    logCheckoutError("cart_membership_sync_failed", error, { cartId });
  }

  try {
    return await fetchCartById(cartId);
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

async function fetchCartById(cartId: string): Promise<Cart | null> {
  const query = `#graphql
    query GetCart($cartId: ID!) {
      cart(id: $cartId) {
        ${CART_FIELDS}
      }
    }
  `;

  const data = await storefrontQuery<{ cart: CartPayload | null }>(
    query,
    { cartId },
    { cache: "no-store" },
  );

  return normalizeCart(data.cart);
}

async function finalizeCartMutation(cart: CartPayload | null | undefined) {
  const normalized = await persistCart(cart);
  const session = await getStoreSession();

  if (!session) {
    return normalized;
  }

  try {
    await syncCartForActiveSession();
  } catch (error) {
    logCheckoutError("cart_membership_sync_failed", error, { cartId: normalized.id });
  }

  if (session.isMembershipActive) {
    const refreshed = await fetchCartById(normalized.id);
    return refreshed ?? normalized;
  }

  return normalized;
}

export async function createCart(
  merchandiseId: string,
  quantity: number,
): Promise<Cart> {
  const mutation = `#graphql
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
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
    input: await cartCreateInput([{ merchandiseId, quantity }]),
  });

  const error = getUserErrors(data.cartCreate.userErrors);
  if (error) throw new Error(error);

  return finalizeCartMutation(data.cartCreate.cart);
}

export async function addManyToCart(
  lines: Array<{ merchandiseId: string; quantity: number }>,
): Promise<Cart> {
  if (!lines.length) {
    throw new Error("No cart lines provided");
  }

  const cartId = await getCartIdFromCookie();

  if (!cartId) {
    const mutation = `#graphql
      mutation CartCreate($input: CartInput!) {
        cartCreate(input: $input) {
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
      input: await cartCreateInput(lines),
    });

    const error = getUserErrors(data.cartCreate.userErrors);
    if (error) throw new Error(error);

    return finalizeCartMutation(data.cartCreate.cart);
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
    lines: lines.map((line) => ({
      merchandiseId: line.merchandiseId,
      quantity: line.quantity,
    })),
  });

  const error = getUserErrors(data.cartLinesAdd.userErrors);
  if (error) throw new Error(error);

  return finalizeCartMutation(data.cartLinesAdd.cart);
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

  return finalizeCartMutation(data.cartLinesAdd.cart);
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

  return finalizeCartMutation(data.cartLinesUpdate.cart);
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
    return cart;
  }

  return finalizeCartMutation(data.cartLinesRemove.cart);
}
