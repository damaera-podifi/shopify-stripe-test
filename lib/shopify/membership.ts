import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";
import { normalizeAuthEmail } from "@/lib/auth/user-id";
import { adminGraphql } from "./admin";

export const MEMBERSHIP_METAFIELD_NAMESPACE = "custom";
export const MEMBERSHIP_METAFIELD_KEY = "is_membership_active";
export const MEMBERSHIP_CUSTOMER_TAG = "is_membership_active";

export type MembershipSyncResult = {
  shopifyCustomerId: string;
  email: string;
  isMembershipActive: boolean;
};

type CustomerLookup = {
  id: string;
  tags: string[];
  isMembershipActive: boolean | null;
};

function customerMembershipState(
  customer: CustomerLookup,
  isMembershipActive: boolean,
): { metafieldMatches: boolean; tagMatches: boolean } {
  const metafieldMatches =
    customer.isMembershipActive === null
      ? !isMembershipActive
      : customer.isMembershipActive === isMembershipActive;
  const tagMatches = isMembershipActive
    ? customer.tags.includes(MEMBERSHIP_CUSTOMER_TAG)
    : !customer.tags.includes(MEMBERSHIP_CUSTOMER_TAG);

  return { metafieldMatches, tagMatches };
}

export async function findShopifyCustomerByEmail(
  email: string,
): Promise<CustomerLookup | null> {
  const normalizedEmail = normalizeAuthEmail(email);
  const data = await adminGraphql<{
    customers: {
      edges: Array<{
        node: {
          id: string;
          email: string;
          tags: string[];
          metafield: { value: string } | null;
        };
      }>;
    };
  }>(
    `#graphql
      query FindCustomerByEmail($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              email
              tags
              metafield(namespace: "${MEMBERSHIP_METAFIELD_NAMESPACE}", key: "${MEMBERSHIP_METAFIELD_KEY}") {
                value
              }
            }
          }
        }
      }
    `,
    { query: `email:"${normalizedEmail.replace(/"/g, '\\"')}"` },
    { operation: "findCustomerByEmail" },
  );

  const node = data.customers.edges[0]?.node;
  if (!node) return null;

  return {
    id: node.id,
    tags: node.tags,
    isMembershipActive:
      node.metafield?.value === undefined
        ? null
        : node.metafield.value === "true",
  };
}

function membershipTags(existingTags: string[], isMembershipActive: boolean): string[] {
  const withoutMembershipTag = existingTags.filter(
    (tag) => tag !== MEMBERSHIP_CUSTOMER_TAG,
  );

  if (isMembershipActive) {
    return [...withoutMembershipTag, MEMBERSHIP_CUSTOMER_TAG];
  }

  return withoutMembershipTag;
}

async function createCustomer(
  email: string,
  isMembershipActive: boolean,
): Promise<CustomerLookup> {
  const normalizedEmail = normalizeAuthEmail(email);
  const data = await adminGraphql<{
    customerCreate: {
      customer: { id: string; tags: string[] } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    `#graphql
      mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      input: {
        email: normalizedEmail,
        ...(isMembershipActive
          ? { tags: [MEMBERSHIP_CUSTOMER_TAG] }
          : {}),
      },
    },
    { operation: "customerCreate" },
  );

  const errors = data.customerCreate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  const customer = data.customerCreate.customer;
  if (!customer) {
    throw new Error("Failed to create Shopify customer");
  }

  return {
    id: customer.id,
    tags: customer.tags,
    isMembershipActive: isMembershipActive ? true : false,
  };
}

async function setMembershipMetafield(
  shopifyCustomerId: string,
  isMembershipActive: boolean,
): Promise<void> {
  const data = await adminGraphql<{
    metafieldsSet: {
      metafields: Array<{ id: string }> | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    `#graphql
      mutation SetMembershipMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      metafields: [
        {
          ownerId: shopifyCustomerId,
          namespace: MEMBERSHIP_METAFIELD_NAMESPACE,
          key: MEMBERSHIP_METAFIELD_KEY,
          type: "boolean",
          value: isMembershipActive ? "true" : "false",
        },
      ],
    },
    { operation: "setMembershipMetafield" },
  );

  const errors = data.metafieldsSet.userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }
}

async function setMembershipCustomerTag(
  shopifyCustomerId: string,
  existingTags: string[],
  isMembershipActive: boolean,
): Promise<string[]> {
  const nextTags = membershipTags(existingTags, isMembershipActive);

  const data = await adminGraphql<{
    customerUpdate: {
      customer: { id: string; tags: string[] } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    `#graphql
      mutation UpdateMembershipCustomerTag($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      input: {
        id: shopifyCustomerId,
        tags: nextTags,
      },
    },
    { operation: "setMembershipCustomerTag" },
  );

  const errors = data.customerUpdate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  return data.customerUpdate.customer?.tags ?? nextTags;
}

export async function syncMembershipCustomerToShopify(
  email: string,
  isMembershipActive: boolean,
): Promise<MembershipSyncResult> {
  const normalizedEmail = normalizeAuthEmail(email);

  logCheckout("membership_sync_start", {
    email: normalizedEmail,
    isMembershipActive,
  });

  try {
    const existing = await findShopifyCustomerByEmail(normalizedEmail);
    const customer =
      existing ?? (await createCustomer(normalizedEmail, isMembershipActive));

    const { metafieldMatches, tagMatches } = customerMembershipState(
      customer,
      isMembershipActive,
    );

    if (!metafieldMatches) {
      await setMembershipMetafield(customer.id, isMembershipActive);
    }

    const tags = tagMatches
      ? membershipTags(customer.tags, isMembershipActive)
      : await setMembershipCustomerTag(
          customer.id,
          customer.tags,
          isMembershipActive,
        );

    logCheckout("membership_sync_ok", {
      email: normalizedEmail,
      shopifyCustomerId: customer.id,
      isMembershipActive,
      tags,
    });

    return {
      shopifyCustomerId: customer.id,
      email: normalizedEmail,
      isMembershipActive,
    };
  } catch (error) {
    logCheckoutError("membership_sync_failed", error, {
      email: normalizedEmail,
      isMembershipActive,
    });
    throw error;
  }
}
