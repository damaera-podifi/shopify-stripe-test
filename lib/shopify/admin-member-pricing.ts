import { getTrackedSegmentIds } from "@/lib/auth/segments";
import { adminGraphql } from "./admin";
import { findShopifyCustomerByEmail } from "./customer";
import {
  getMemberDiscountPercent,
  getMemberDiscountTitle,
} from "./member-pricing";

export type AdminMemberPricing = {
  isMember: boolean;
  discountPercent: number | null;
  discountTitle: string;
  shopifyCustomerId: string;
};

export async function resolveShopifyCustomerIdForEmail(
  email: string,
  existingId: string | null,
): Promise<string | null> {
  const found = await findShopifyCustomerByEmail(email);
  if (found) return found.id;
  return existingId;
}

export async function getAdminMemberPricing(input: {
  email: string;
  shopifyCustomerId: string | null;
}): Promise<AdminMemberPricing | null> {
  const segmentIds = getTrackedSegmentIds();
  const discountPercent = getMemberDiscountPercent();
  if (!segmentIds.length || discountPercent === null) return null;

  const shopifyCustomerId = await resolveShopifyCustomerIdForEmail(
    input.email,
    input.shopifyCustomerId,
  );
  if (!shopifyCustomerId) return null;

  const query = `#graphql
    query CustomerSegmentMembership($customerId: ID!, $segmentIds: [ID!]!) {
      customerSegmentMembership(customerId: $customerId, segmentIds: $segmentIds) {
        memberships {
          segmentId
          isMember
        }
      }
    }
  `;

  const data = await adminGraphql<{
    customerSegmentMembership: {
      memberships: Array<{ segmentId: string; isMember: boolean }>;
    };
  }>(
    query,
    { customerId: shopifyCustomerId, segmentIds },
    { operation: "customerSegmentMembership" },
  );

  const isMember = data.customerSegmentMembership.memberships.some(
    (m) => m.isMember,
  );

  return {
    isMember,
    discountPercent: isMember ? discountPercent : null,
    discountTitle: getMemberDiscountTitle(),
    shopifyCustomerId,
  };
}
