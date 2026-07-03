import { revalidateTag } from "next/cache";
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
import { ShippingAddressValidationError } from "@/lib/checkout/shipping-address-validation-error";
import { storefrontMutation, storefrontQuery } from "./storefront";

export const STORE_CART_CACHE_TAG = "store-cart";

export type CartMoney = {
  amount: string;
  currencyCode: string;
};

export type CartDiscountCode = {
  code: string;
  applicable: boolean;
};

export type CartDiscountAllocation = {
  discountedAmount: CartMoney;
  title: string;
  source: "automatic" | "code";
  code?: string;
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
    totalTaxAmount?: CartMoney | null;
    totalAmountEstimated?: boolean;
  };
  discountCodes: CartDiscountCode[];
  /** Order-level and other cart-wide discount allocations (e.g. order discount codes). */
  cartDiscountAllocations: CartDiscountAllocation[];
  discountTotal: CartMoney | null;
  lines: CartLine[];
};

/** Smaller payload for add/create mutations (faster Storefront responses). */
const CART_SUMMARY_FIELDS = `
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
    totalTaxAmount {
      amount
      currencyCode
    }
    totalAmountEstimated
  }
`;

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  discountCodes {
    code
    applicable
  }
  cost {
    subtotalAmount {
      amount
      currencyCode
    }
    totalAmount {
      amount
      currencyCode
    }
    totalTaxAmount {
      amount
      currencyCode
    }
    totalAmountEstimated
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
  discountCodes?: CartDiscountCode[];
  cost: {
    subtotalAmount: CartMoney;
    totalAmount: CartMoney;
    totalTaxAmount?: CartMoney | null;
    totalAmountEstimated?: boolean;
  };
  discountAllocations?: CartLinePayload["discountAllocations"];
  lines?: { edges: Array<{ node: CartLinePayload }> };
};

function normalizeDiscountAllocations(
  allocations: CartLinePayload["discountAllocations"],
): CartDiscountAllocation[] {
  return allocations.map((allocation) => ({
    discountedAmount: allocation.discountedAmount,
    title: allocation.title ?? allocation.code ?? "Discount",
    source: allocation.code ? ("code" as const) : ("automatic" as const),
    ...(allocation.code ? { code: allocation.code } : {}),
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
    discountCodes: cart.discountCodes ?? [],
    cartDiscountAllocations: normalizeDiscountAllocations(
      cart.discountAllocations ?? [],
    ),
    cost: cart.cost,
    discountTotal:
      discountAmount > 0
        ? {
            amount: discountAmount.toFixed(2),
            currencyCode: cart.cost.totalAmount.currencyCode,
          }
        : null,
    lines: (cart.lines?.edges ?? []).map((edge) => ({
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

/** Lightweight cart count for the store header (no membership sync). */
export async function getCartQuantity(): Promise<number> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) return 0;

  try {
    return await fetchCartQuantityById(cartId);
  } catch {
    await clearCartIdCookie();
    return 0;
  }
}

export function revalidateCartCount() {
  revalidateTag(STORE_CART_CACHE_TAG, "max");
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

async function finalizeCartMutation(
  cart: CartPayload | null | undefined,
  options?: { skipMembershipAdmin?: boolean },
) {
  const normalized = await persistCart(cart);
  const session = await getStoreSession();

  if (!session) {
    return normalized;
  }

  try {
    await syncCartForActiveSession({
      skipMembershipAdmin: options?.skipMembershipAdmin,
    });
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
          ${CART_SUMMARY_FIELDS}
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

  return finalizeCartMutation(data.cartCreate.cart, { skipMembershipAdmin: true });
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
            ${CART_SUMMARY_FIELDS}
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

    return finalizeCartMutation(data.cartCreate.cart, { skipMembershipAdmin: true });
  }

  const mutation = `#graphql
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_SUMMARY_FIELDS}
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

  return finalizeCartMutation(data.cartLinesAdd.cart, { skipMembershipAdmin: true });
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
          ${CART_SUMMARY_FIELDS}
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

  return finalizeCartMutation(data.cartLinesAdd.cart, { skipMembershipAdmin: true });
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

export type CartDiscountWarning = {
  code: string;
  message: string;
};

export type CartDiscountUpdateResult = {
  cart: Cart;
  warnings: CartDiscountWarning[];
};

export async function updateCartDiscountCodes(
  discountCodes: string[],
): Promise<CartDiscountUpdateResult> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) {
    throw new Error("No cart found");
  }

  const mutation = `#graphql
    mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) {
        cart {
          ${CART_FIELDS}
        }
        userErrors {
          message
        }
        warnings {
          code
          message
        }
      }
    }
  `;

  const data = await storefrontMutation<{
    cartDiscountCodesUpdate: {
      cart: CartPayload | null;
      userErrors: Array<{ message: string }>;
      warnings: CartDiscountWarning[];
    };
  }>(mutation, {
    cartId,
    discountCodes,
  });

  const error = getUserErrors(data.cartDiscountCodesUpdate.userErrors);
  if (error) throw new Error(error);

  const cart = await finalizeCartMutation(data.cartDiscountCodesUpdate.cart);

  return {
    cart,
    warnings: data.cartDiscountCodesUpdate.warnings ?? [],
  };
}

export async function applyCartDiscountCode(
  code: string,
): Promise<CartDiscountUpdateResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("Enter a discount code");
  }

  return updateCartDiscountCodes([trimmed]);
}

export async function clearCartDiscountCodes(): Promise<CartDiscountUpdateResult> {
  return updateCartDiscountCodes([]);
}

export type CartDeliveryAddressInput = {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
};

function selectableDeliveryAddressInput(address: CartDeliveryAddressInput) {
  return {
    selected: true,
    oneTimeUse: true,
    validationStrategy: "STRICT" as const,
    address: {
      deliveryAddress: {
        firstName: address.firstName,
        lastName: address.lastName,
        address1: address.address1,
        address2: address.address2 || undefined,
        city: address.city,
        provinceCode: address.province,
        countryCode: address.country,
        zip: address.zip,
      },
    },
  };
}

async function fetchCartDeliveryAddressIds(
  cartId: string,
): Promise<Array<{ id: string; selected: boolean }>> {
  const query = `#graphql
    query CartDeliveryAddresses($cartId: ID!) {
      cart(id: $cartId) {
        delivery {
          addresses {
            id
            selected
          }
        }
      }
    }
  `;

  const data = await storefrontQuery<{
    cart: {
      delivery: {
        addresses: Array<{ id: string; selected: boolean }>;
      } | null;
    } | null;
  }>(query, { cartId }, { cache: "no-store" });

  return data.cart?.delivery?.addresses ?? [];
}

/** Apply shipping address so Shopify can estimate tax on the cart. */
export async function applyCartDeliveryAddress(
  address: CartDeliveryAddressInput,
): Promise<Cart> {
  const cartId = await getCartIdFromCookie();
  if (!cartId) {
    throw new Error("No cart found");
  }

  const identityMutation = `#graphql
    mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        userErrors {
          message
        }
      }
    }
  `;

  const identityData = await storefrontMutation<{
    cartBuyerIdentityUpdate: {
      userErrors: Array<{ message: string }>;
    };
  }>(identityMutation, {
    cartId,
    buyerIdentity: {
      email: address.email,
      countryCode: address.country,
    },
  });

  const identityErrors = identityData.cartBuyerIdentityUpdate.userErrors;
  if (identityErrors.length) {
    throw new Error(identityErrors.map((error) => error.message).join(", "));
  }

  const existingAddresses = await fetchCartDeliveryAddressIds(cartId);
  const selectedAddress =
    existingAddresses.find((entry) => entry.selected) ?? existingAddresses[0];

  if (selectedAddress) {
    const updateMutation = `#graphql
      mutation CartDeliveryAddressesUpdate(
        $cartId: ID!
        $addresses: [CartSelectableAddressUpdateInput!]!
      ) {
        cartDeliveryAddressesUpdate(cartId: $cartId, addresses: $addresses) {
          cart {
            ${CART_FIELDS}
          }
          userErrors {
            message
          }
        }
      }
    `;

    const updateData = await storefrontMutation<{
      cartDeliveryAddressesUpdate: {
        cart: CartPayload | null;
        userErrors: Array<{ message: string }>;
      };
    }>(updateMutation, {
      cartId,
      addresses: [
        {
          id: selectedAddress.id,
          ...selectableDeliveryAddressInput(address),
        },
      ],
    });

    const updateErrors = updateData.cartDeliveryAddressesUpdate.userErrors;
    if (updateErrors.length) {
      throw new ShippingAddressValidationError(
        updateErrors.map((error) => error.message).join(", "),
      );
    }

    const cart = normalizeCart(updateData.cartDeliveryAddressesUpdate.cart);
    if (!cart) {
      throw new Error("Failed to update cart delivery address");
    }

    return cart;
  }

  const deliveryMutation = `#graphql
    mutation CartDeliveryAddressesAdd(
      $cartId: ID!
      $addresses: [CartSelectableAddressInput!]!
    ) {
      cartDeliveryAddressesAdd(cartId: $cartId, addresses: $addresses) {
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
    cartDeliveryAddressesAdd: {
      cart: CartPayload | null;
      userErrors: Array<{ message: string }>;
    };
  }>(deliveryMutation, {
    cartId,
    addresses: [selectableDeliveryAddressInput(address)],
  });

  const errors = data.cartDeliveryAddressesAdd.userErrors;
  if (errors.length) {
    throw new ShippingAddressValidationError(
      errors.map((error) => error.message).join(", "),
    );
  }

  const cart = normalizeCart(data.cartDeliveryAddressesAdd.cart);
  if (!cart) {
    throw new Error("Failed to update cart delivery address");
  }

  return cart;
}
