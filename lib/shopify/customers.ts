import { adminGraphql } from "./admin";
import {
  MEMBERSHIP_METAFIELD_KEY,
  MEMBERSHIP_METAFIELD_NAMESPACE,
} from "./membership";

export type ShopifyCustomer = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isMembershipActive: boolean | null;
};

type CustomersQueryResult = {
  customers: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        createdAt: string;
        updatedAt: string;
        tags: string[];
        metafield: { value: string } | null;
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

const CUSTOMERS_QUERY = `#graphql
  query GetCustomers($first: Int!, $after: String) {
    customers(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          email
          firstName
          lastName
          createdAt
          updatedAt
          tags
          metafield(namespace: "${MEMBERSHIP_METAFIELD_NAMESPACE}", key: "${MEMBERSHIP_METAFIELD_KEY}") {
            value
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function parseMembershipMetafield(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  return value === "true";
}

function normalizeCustomer(
  node: CustomersQueryResult["customers"]["edges"][number]["node"],
): ShopifyCustomer {
  return {
    id: node.id,
    email: node.email,
    firstName: node.firstName,
    lastName: node.lastName,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    tags: node.tags,
    isMembershipActive: parseMembershipMetafield(node.metafield?.value),
  };
}

export async function getShopifyCustomers(options?: {
  first?: number;
  after?: string | null;
}) {
  const first = Math.min(Math.max(options?.first ?? 50, 1), 250);
  const after = options?.after ?? null;

  const data = await adminGraphql<CustomersQueryResult>(
    CUSTOMERS_QUERY,
    { first, after },
    { operation: "getCustomers" },
  );

  return {
    customers: data.customers.edges.map((edge) => normalizeCustomer(edge.node)),
    pageInfo: data.customers.pageInfo,
  };
}

export async function getAllShopifyCustomers(options?: { pageSize?: number }) {
  const pageSize = Math.min(Math.max(options?.pageSize ?? 50, 1), 250);
  const customers: ShopifyCustomer[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await getShopifyCustomers({ first: pageSize, after });
    customers.push(...page.customers);
    hasNextPage = page.pageInfo.hasNextPage;
    after = page.pageInfo.endCursor;
  }

  return customers;
}
