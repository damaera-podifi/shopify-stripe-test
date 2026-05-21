import type { CheckoutShippingInput } from "@/lib/checkout/types";
import type { UserRecord } from "./types";

const emptyShipping = (): CheckoutShippingInput => ({
  email: "",
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  province: "",
  zip: "",
  country: "US",
});

/** Build checkout shipping from account email + saved profile. */
export function checkoutShippingFromUser(
  user: UserRecord | null | undefined,
): CheckoutShippingInput {
  if (!user) return emptyShipping();

  const profile = user.checkoutProfile;
  if (!profile) {
    return { ...emptyShipping(), email: user.email };
  }

  return {
    email: user.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    address1: profile.address1,
    address2: profile.address2 ?? "",
    city: profile.city,
    province: profile.province,
    zip: profile.zip,
    country: profile.country,
  };
}

export function hasCompleteCheckoutProfile(
  user: UserRecord | null | undefined,
): boolean {
  if (!user?.checkoutProfile) return false;
  const p = user.checkoutProfile;
  return Boolean(
    p.firstName &&
      p.lastName &&
      p.address1 &&
      p.city &&
      p.province &&
      p.zip &&
      p.country,
  );
}
