import type { CheckoutShippingInput } from "./types";

export function parseShippingFromBody(
  body: Record<string, unknown>,
): CheckoutShippingInput | { error: string } {
  const email = String(body.email ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const address1 = String(body.address1 ?? "").trim();
  const address2 = String(body.address2 ?? "").trim();
  const city = String(body.city ?? "").trim();
  const province = String(body.province ?? "").trim();
  const zip = String(body.zip ?? "").trim();
  const country = String(body.country ?? "US").trim().toUpperCase();

  if (!email || !email.includes("@")) {
    return { error: "Valid email is required" };
  }
  if (!firstName || !lastName) {
    return { error: "First and last name are required" };
  }
  if (!address1 || !city || !province || !zip) {
    return { error: "Complete shipping address is required" };
  }
  if (country.length !== 2) {
    return { error: "Country must be a 2-letter code (e.g. US)" };
  }

  return {
    email,
    firstName,
    lastName,
    address1,
    address2: address2 || undefined,
    city,
    province,
    zip,
    country,
  };
}
