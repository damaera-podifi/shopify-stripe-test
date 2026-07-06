import type { CheckoutShippingInput } from "./types";

/** Dev/test address in California — triggers Shopify tax in this store. */
export const DEV_CHECKOUT_SHIPPING: Omit<CheckoutShippingInput, "email"> = {
  firstName: "Test",
  lastName: "User",
  address1: "123 Main Street",
  address2: "",
  city: "Los Angeles",
  province: "CA",
  zip: "90001",
  country: "US",
};

const DEV_CHECKOUT_EMAIL = "test@example.com";

export function resolveCheckoutDefaultShipping(options: {
  sessionEmail?: string | null;
  savedShipping?: Partial<CheckoutShippingInput> | null;
}): Partial<CheckoutShippingInput> {
  const devPrefill =
    process.env.NODE_ENV === "development" ? DEV_CHECKOUT_SHIPPING : {};

  const email =
    options.savedShipping?.email?.trim() ||
    options.sessionEmail?.trim() ||
    (process.env.NODE_ENV === "development" ? DEV_CHECKOUT_EMAIL : "");

  return {
    country: "US",
    ...devPrefill,
    ...options.savedShipping,
    ...(email ? { email } : {}),
  };
}
