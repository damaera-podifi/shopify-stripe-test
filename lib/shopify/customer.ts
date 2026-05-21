import { adminGraphql } from "./admin";

export async function findShopifyCustomerByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const query = `#graphql
    query CustomerByEmail($identifier: CustomerIdentifierInput!) {
      customer: customerByIdentifier(identifier: $identifier) {
        id
        email
      }
    }
  `;

  const data = await adminGraphql<{
    customer: { id: string; email: string } | null;
  }>(
    query,
    { identifier: { emailAddress: email.trim().toLowerCase() } },
    { operation: "customerByIdentifier" },
  );

  return data.customer;
}

export async function createShopifyCustomer(input: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ id: string; email: string }> {
  const mutation = `#graphql
    mutation CustomerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await adminGraphql<{
    customerCreate: {
      customer: { id: string; email: string } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    mutation,
    {
      input: {
        email: input.email.trim().toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
      },
    },
    { operation: "customerCreate" },
  );

  const errors = data.customerCreate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  const customer = data.customerCreate.customer;
  if (!customer) {
    throw new Error("Failed to create Shopify customer");
  }

  return customer;
}

/** Ensures a Shopify customer exists for new Customer Accounts stores (Admin API). */
export async function ensureShopifyCustomer(email: string): Promise<string> {
  const existing = await findShopifyCustomerByEmail(email);
  if (existing) return existing.id;
  const created = await createShopifyCustomer({ email });
  return created.id;
}

export type SegmentMembership = {
  segmentId: string;
  isMember: boolean;
};

export async function getCustomerSegmentMemberships(
  customerId: string,
  segmentIds: string[],
): Promise<SegmentMembership[]> {
  if (!segmentIds.length) return [];

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
      memberships: SegmentMembership[];
    };
  }>(
    query,
    { customerId, segmentIds },
    { operation: "customerSegmentMembership" },
  );

  return data.customerSegmentMembership.memberships ?? [];
}
