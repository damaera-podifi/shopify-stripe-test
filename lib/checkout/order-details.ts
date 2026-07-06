import { adminGraphql } from "@/lib/shopify/admin";
import type { CheckoutTaxLine } from "./types";
import { APP_USER_ID_KEY, APP_USER_ID_NAMESPACE } from "@/lib/auth/user-id";
import { findShopifyCustomerByEmail } from "@/lib/shopify/membership";
import { fulfillStripePayment } from "./fulfillment";

export type OrderLineItemDetails = {
  title: string;
  variantTitle: string | null;
  variantId: string | null;
  quantity: number;
  unitPrice: {
    amount: string;
    currencyCode: string;
  };
  image: {
    url: string;
    altText: string | null;
  } | null;
};

export type OrderTrackingDetails = {
  company: string | null;
  number: string | null;
  url: string | null;
};

export type ReturnableLineItem = {
  fulfillmentLineItemId: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
};

export type OrderReturnSummary = {
  id: string;
  name: string;
  status: string;
};

export type OrderListItem = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  total: {
    amount: string;
    currencyCode: string;
  };
};

export type OrderDetails = {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  cancelledAt: string | null;
  financialStatus: string;
  fulfillmentStatus: string;
  subtotal: {
    amount: string;
    currencyCode: string;
  };
  tax: {
    amount: string;
    currencyCode: string;
  };
  taxesIncluded: boolean;
  taxLines: CheckoutTaxLine[];
  total: {
    amount: string;
    currencyCode: string;
  };
  lineItems: OrderLineItemDetails[];
  tracking: OrderTrackingDetails[];
  returnableLineItems: ReturnableLineItem[];
  returns: OrderReturnSummary[];
  canCancel: boolean;
  canReorder: boolean;
  canRequestReturn: boolean;
  userId: string | null;
};

type AdminOrderResponse = {
  order: {
    id: string;
    name: string;
    email: string | null;
    createdAt: string;
    cancelledAt: string | null;
    displayFinancialStatus: string;
    displayFulfillmentStatus: string;
    metafield: {
      value: string;
    } | null;
    taxesIncluded: boolean;
    subtotalPriceSet: {
      shopMoney: {
        amount: string;
        currencyCode: string;
      };
    };
    totalTaxSet: {
      shopMoney: {
        amount: string;
        currencyCode: string;
      };
    };
    totalPriceSet: {
      shopMoney: {
        amount: string;
        currencyCode: string;
      };
    };
    taxLines: Array<{
      title: string;
      rate: number;
      priceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
    lineItems: {
      nodes: Array<{
        title: string;
        variantTitle: string | null;
        quantity: number;
        variant: { id: string } | null;
        originalUnitPriceSet: {
          shopMoney: {
            amount: string;
            currencyCode: string;
          };
        };
        image: {
          url: string;
          altText: string | null;
        } | null;
      }>;
    };
    fulfillments: Array<{
      status: string;
      trackingInfo: Array<{
        company: string | null;
        number: string | null;
        url: string | null;
      }>;
      fulfillmentLineItems: {
        nodes: Array<{
          id: string;
          quantity: number;
          lineItem: {
            title: string;
            variantTitle: string | null;
          };
        }>;
      };
    }>;
  } | null;
};

type AdminOrderReturnsResponse = {
  order: {
    returns: {
      nodes: Array<{
        id: string;
        name: string;
        status: string;
      }>;
    };
  } | null;
};

const ORDER_DETAILS_QUERY = `#graphql
  query OrderDetails($id: ID!) {
    order(id: $id) {
      id
      name
      email
      createdAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      metafield(namespace: "${APP_USER_ID_NAMESPACE}", key: "${APP_USER_ID_KEY}") {
        value
      }
      taxesIncluded
      subtotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      totalTaxSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      taxLines {
        title
        rate
        priceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
      lineItems(first: 50) {
        nodes {
          title
          variantTitle
          quantity
          variant {
            id
          }
          originalUnitPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          image {
            url
            altText
          }
        }
      }
      fulfillments(first: 10) {
        status
        trackingInfo(first: 10) {
          company
          number
          url
        }
        fulfillmentLineItems(first: 50) {
          nodes {
            id
            quantity
            lineItem {
              title
              variantTitle
            }
          }
        }
      }
    }
  }
`;

const ORDER_RETURNS_QUERY = `#graphql
  query OrderReturns($id: ID!) {
    order(id: $id) {
      returns(first: 10) {
        nodes {
          id
          name
          status
        }
      }
    }
  }
`;

const FULFILLED_STATUSES = new Set(["FULFILLED", "PARTIALLY_FULFILLED"]);
const NON_CANCELLABLE_FINANCIAL = new Set(["REFUNDED", "VOIDED", "EXPIRED"]);

function deriveOrderCapabilities(
  order: NonNullable<AdminOrderResponse["order"]>,
  returns: OrderReturnSummary[],
) {
  const returnableLineItems = order.fulfillments.flatMap((fulfillment) =>
    fulfillment.fulfillmentLineItems.nodes.map((item) => ({
      fulfillmentLineItemId: item.id,
      title: item.lineItem.title,
      variantTitle: item.lineItem.variantTitle,
      quantity: item.quantity,
    })),
  );

  const hasVariants = order.lineItems.nodes.some((item) => item.variant?.id);
  const isCancelled = Boolean(order.cancelledAt);
  const isFulfilled = FULFILLED_STATUSES.has(order.displayFulfillmentStatus);
  const isPaid =
    order.displayFinancialStatus === "PAID" ||
    order.displayFinancialStatus === "PARTIALLY_REFUNDED";

  return {
    returnableLineItems,
    returns,
    canCancel:
      !isCancelled &&
      !isFulfilled &&
      isPaid &&
      !NON_CANCELLABLE_FINANCIAL.has(order.displayFinancialStatus),
    canReorder: hasVariants && !isCancelled,
    canRequestReturn:
      !isCancelled &&
      isFulfilled &&
      returnableLineItems.length > 0 &&
      isPaid,
  };
}

async function fetchOrderReturns(
  shopifyOrderId: string,
): Promise<OrderReturnSummary[]> {
  try {
    const data = await adminGraphql<AdminOrderReturnsResponse>(
      ORDER_RETURNS_QUERY,
      { id: shopifyOrderId },
      {
        operation: "orderReturns",
        // The `returns` field requires the `read_returns` access scope.
        // Stores that haven't granted it surface ACCESS_DENIED, which we
        // already handle by rendering the order details without return
        // history, so this is not a real error.
        expectedErrorCodes: ["ACCESS_DENIED"],
      },
    );

    return (
      data.order?.returns.nodes.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
      })) ?? []
    );
  } catch {
    // Missing read_returns scope — order details still load without return history.
    return [];
  }
}

export async function getShopifyOrderDetails(
  shopifyOrderId: string,
): Promise<OrderDetails | null> {
  const data = await adminGraphql<AdminOrderResponse>(
    ORDER_DETAILS_QUERY,
    { id: shopifyOrderId },
    { operation: "orderDetails" },
  );

  const order = data.order;
  if (!order) {
    return null;
  }

  const tracking = order.fulfillments.flatMap((fulfillment) =>
    fulfillment.trackingInfo.map((info) => ({
      company: info.company,
      number: info.number,
      url: info.url,
    })),
  );

  const returns = await fetchOrderReturns(shopifyOrderId);
  const capabilities = deriveOrderCapabilities(order, returns);

  return {
    id: order.id,
    name: order.name,
    email: order.email,
    createdAt: order.createdAt,
    cancelledAt: order.cancelledAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    subtotal: order.subtotalPriceSet.shopMoney,
    tax: order.totalTaxSet.shopMoney,
    taxesIncluded: order.taxesIncluded,
    taxLines: order.taxLines.map((line) => ({
      title: line.title,
      amount: line.priceSet.shopMoney.amount,
      rate: line.rate,
    })),
    total: order.totalPriceSet.shopMoney,
    lineItems: order.lineItems.nodes.map((item) => ({
      title: item.title,
      variantTitle: item.variantTitle,
      variantId: item.variant?.id ?? null,
      quantity: item.quantity,
      unitPrice: item.originalUnitPriceSet.shopMoney,
      image: item.image,
    })),
    tracking,
    userId: order.metafield?.value ?? null,
    ...capabilities,
  };
}

export async function getOrderDetailsByPaymentIntent(
  paymentIntentId: string,
): Promise<OrderDetails | null> {
  const fulfillment = await fulfillStripePayment(paymentIntentId);
  return getShopifyOrderDetails(fulfillment.shopifyOrderId);
}

type AdminOrderListNode = {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  metafield: { value: string } | null;
  totalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
};

type AdminOrdersListResponse = {
  orders: {
    nodes: AdminOrderListNode[];
  };
};

const ORDER_LIST_NODES_SELECTION = `
  id
  name
  email
  createdAt
  displayFinancialStatus
  displayFulfillmentStatus
  metafield(namespace: "${APP_USER_ID_NAMESPACE}", key: "${APP_USER_ID_KEY}") {
    value
  }
  totalPriceSet {
    shopMoney {
      amount
      currencyCode
    }
  }
`;

const ORDERS_LIST_QUERY = `#graphql
  query OrdersList($query: String!, $first: Int!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        ${ORDER_LIST_NODES_SELECTION}
      }
    }
  }
`;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function escapeShopifySearchValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function shopifyGidToLegacyId(gid: string): string | null {
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : null;
}

function orderBelongsToUser(
  order: Pick<AdminOrderListNode, "email" | "metafield">,
  userId: string,
  loginEmail: string,
): boolean {
  const orderUserId = order.metafield?.value ?? null;
  if (orderUserId) {
    return orderUserId === userId;
  }

  if (!order.email) {
    return false;
  }

  return normalizeEmail(order.email) === normalizeEmail(loginEmail);
}

function mapOrderListItem(order: AdminOrderListNode): OrderListItem {
  return {
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    total: order.totalPriceSet.shopMoney,
  };
}

async function listShopifyOrdersBySearchQuery(
  query: string,
  operation: string,
): Promise<AdminOrderListNode[]> {
  const data = await adminGraphql<AdminOrdersListResponse>(
    ORDERS_LIST_QUERY,
    { query, first: 50 },
    { operation },
  );

  return data.orders.nodes;
}

export async function listShopifyOrdersByEmail(
  email: string,
): Promise<OrderListItem[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const nodes = await listShopifyOrdersBySearchQuery(
    `email:${escapeShopifySearchValue(normalizedEmail)}`,
    "ordersByEmail",
  );

  return nodes.map(mapOrderListItem);
}

async function listShopifyOrdersByUserIdMetafield(
  userId: string,
): Promise<AdminOrderListNode[]> {
  return listShopifyOrdersBySearchQuery(
    `metafields.${APP_USER_ID_NAMESPACE}.${APP_USER_ID_KEY}:${userId}`,
    "ordersByUserId",
  );
}

async function listShopifyOrdersByCustomerId(
  shopifyCustomerGid: string,
): Promise<AdminOrderListNode[]> {
  const legacyId = shopifyGidToLegacyId(shopifyCustomerGid);
  if (!legacyId) {
    return [];
  }

  return listShopifyOrdersBySearchQuery(
    `customer_id:${legacyId}`,
    "ordersByCustomerId",
  );
}

export async function listShopifyOrdersForUser(
  userId: string,
  loginEmail: string,
): Promise<OrderListItem[]> {
  const normalizedEmail = normalizeEmail(loginEmail);
  const customer = normalizedEmail
    ? await findShopifyCustomerByEmail(normalizedEmail).catch(() => null)
    : null;

  const [byUserId, byCustomerId, byEmail] = await Promise.all([
    listShopifyOrdersByUserIdMetafield(userId).catch(
      () => [] as AdminOrderListNode[],
    ),
    customer
      ? listShopifyOrdersByCustomerId(customer.id).catch(
          () => [] as AdminOrderListNode[],
        )
      : Promise.resolve([] as AdminOrderListNode[]),
    normalizedEmail
      ? listShopifyOrdersBySearchQuery(
          `email:${escapeShopifySearchValue(normalizedEmail)}`,
          "ordersByEmail",
        ).catch(() => [] as AdminOrderListNode[])
      : Promise.resolve([] as AdminOrderListNode[]),
  ]);

  const merged = new Map<string, OrderListItem>();
  for (const order of [...byUserId, ...byCustomerId, ...byEmail]) {
    if (!orderBelongsToUser(order, userId, loginEmail)) {
      continue;
    }
    merged.set(order.id, mapOrderListItem(order));
  }

  return [...merged.values()].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getShopifyOrderDetailsForUser(
  shopifyOrderId: string,
  userId: string,
  loginEmail: string,
): Promise<OrderDetails | null> {
  const order = await getShopifyOrderDetails(shopifyOrderId);
  if (!order) {
    return null;
  }

  if (order.userId === userId) {
    return order;
  }

  if (order.userId) {
    return null;
  }

  if (
    order.email &&
    normalizeEmail(order.email) === normalizeEmail(loginEmail)
  ) {
    return order;
  }

  return null;
}

export async function getShopifyOrderDetailsForEmail(
  shopifyOrderId: string,
  email: string,
): Promise<OrderDetails | null> {
  const order = await getShopifyOrderDetails(shopifyOrderId);
  if (!order?.email) {
    return null;
  }

  if (normalizeEmail(order.email) !== normalizeEmail(email)) {
    return null;
  }

  return order;
}

export { normalizeEmail };
