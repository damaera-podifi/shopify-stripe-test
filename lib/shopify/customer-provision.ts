import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";
import { normalizeAuthEmail } from "@/lib/auth/user-id";
import type { StoreUserRecord } from "@/lib/auth/users-db";
import { ensureStorefrontCustomerAccount } from "./customer-access-token";
import {
  findShopifyCustomerByEmail,
  syncMembershipCustomerToShopify,
} from "./membership";

export type ProvisionShopifyCustomerResult = {
  email: string;
  isMembershipActive: boolean;
  shopifyCustomerId?: string;
  storefrontStatus?: "created" | "exists" | "pending_verification";
};

/**
 * Keeps Shopify in sync with our app user record.
 * - App password stays in our system only.
 * - Existing Shopify customers are updated (tags/metafield), never re-created.
 * - New customers are created via Storefront API; Shopify handles email verification.
 */
export async function provisionShopifyCustomerFromAppUser(
  user: Pick<StoreUserRecord, "email" | "password" | "is_membership_active">,
): Promise<ProvisionShopifyCustomerResult> {
  const email = normalizeAuthEmail(user.email);
  const isMembershipActive = user.is_membership_active;

  logCheckout("shopify_customer_provision_start", {
    email,
    isMembershipActive,
  });

  let storefrontStatus: ProvisionShopifyCustomerResult["storefrontStatus"];

  try {
    if (isMembershipActive) {
      const existing = await findShopifyCustomerByEmail(email);
      if (!existing) {
        storefrontStatus = await ensureStorefrontCustomerAccount(
          email,
          user.password,
        );
      } else {
        storefrontStatus = "exists";
      }
    }

    const sync = await syncMembershipCustomerToShopify(email, isMembershipActive);

    logCheckout("shopify_customer_provision_ok", {
      email,
      isMembershipActive,
      shopifyCustomerId: sync.shopifyCustomerId,
      storefrontStatus,
    });

    return {
      email,
      isMembershipActive,
      shopifyCustomerId: sync.shopifyCustomerId,
      storefrontStatus,
    };
  } catch (error) {
    logCheckoutError("shopify_customer_provision_failed", error, {
      email,
      isMembershipActive,
    });
    throw error;
  }
}
