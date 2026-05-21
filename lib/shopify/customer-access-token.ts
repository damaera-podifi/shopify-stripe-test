import { logCheckout } from "@/lib/checkout/logger";
import { normalizeAuthEmail } from "@/lib/auth/user-id";
import { findShopifyCustomerByEmail } from "./membership";
import { storefrontMutation } from "./storefront";

type CustomerUserError = {
  message: string;
  code?: string;
};

function isBenignCreateError(errors: CustomerUserError[]): boolean {
  return errors.some(
    (error) =>
      error.code === "TAKEN" ||
      /already been taken|already exists|verify your email|click the link included/i.test(
        error.message,
      ),
  );
}

/**
 * Creates a Shopify storefront customer using the app password.
 * Shopify may send a verification email — that is expected for new accounts.
 * Never throws for "already exists" or "verify email" responses.
 */
export async function ensureStorefrontCustomerAccount(
  email: string,
  password: string,
): Promise<"created" | "exists" | "pending_verification"> {
  const normalizedEmail = normalizeAuthEmail(email);
  const existing = await findShopifyCustomerByEmail(normalizedEmail);
  if (existing) {
    return "exists";
  }

  logCheckout("storefront_customer_create_start", { email: normalizedEmail });

  const data = await storefrontMutation<{
    customerCreate: {
      customer: { id: string; email: string | null } | null;
      customerUserErrors: CustomerUserError[];
    };
  }>(
    `#graphql
      mutation CustomerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
          }
          customerUserErrors {
            message
            code
          }
        }
      }
    `,
    {
      input: {
        email: normalizedEmail,
        password,
        acceptsMarketing: false,
      },
    },
  );

  if (data.customerCreate.customer) {
    logCheckout("storefront_customer_create_ok", { email: normalizedEmail });
    return "created";
  }

  const errors = data.customerCreate.customerUserErrors;
  if (isBenignCreateError(errors)) {
    logCheckout("storefront_customer_create_pending", {
      email: normalizedEmail,
      errors,
    });
    return /verify your email|click the link included/i.test(
      errors.map((error) => error.message).join(" "),
    )
      ? "pending_verification"
      : "exists";
  }

  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  return "exists";
}
