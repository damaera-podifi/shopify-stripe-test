import { cache } from "react";
import { syncMembershipCustomerToShopify } from "./membership";

/** Dedupes membership Admin API sync within a single server request. */
export const syncMembershipCustomerForSession = cache(
  (email: string, isMembershipActive: boolean) =>
    syncMembershipCustomerToShopify(email, isMembershipActive),
);
