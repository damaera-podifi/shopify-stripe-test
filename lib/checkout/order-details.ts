import { adminGraphql } from "@/lib/shopify/admin";
import { fulfillStripePayment } from "./fulfillment";

export type OrderLineItemDetails = {
  title: string;
  variantTitle: string | null;
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
  financialStatus: string;
  fulfillmentStatus: string;
  total: {
    amount: string;
    currencyCode: string;
  };
  lineItems: OrderLineItemDetails[];
  tracking: OrderTrackingDetails[];
};

type AdminOrderResponse = {
  order: {
    id: string;
    name: string;
    email: string | null;
    createdAt: string;
    displayFinancialStatus: string;
    displayFulfillmentStatus: string;
    totalPriceSet: {
      shopMoney: {
        amount: string;
        currencyCode: string;
      };
    };
    lineItems: {
      nodes: Array<{
        title: string;
        variantTitle: string | null;
        quantity: number;
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
    }>;
  } | null;
};

const ORDER_DETAILS_QUERY = `#graphql
  query OrderDetails($id: ID!) {
    order(id: $id) {
      id
      name
      email
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      lineItems(first: 50) {
        nodes {
          title
          variantTitle
          quantity
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
      }
    }
  }
`;

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

  return {
    id: order.id,
    name: order.name,
    email: order.email,
    createdAt: order.createdAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    total: order.totalPriceSet.shopMoney,
    lineItems: order.lineItems.nodes.map((item) => ({
      title: item.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      unitPrice: item.originalUnitPriceSet.shopMoney,
      image: item.image,
    })),
    tracking,
  };
}

export async function getOrderDetailsByPaymentIntent(
  paymentIntentId: string,
): Promise<OrderDetails | null> {
  const fulfillment = await fulfillStripePayment(paymentIntentId);
  return getShopifyOrderDetails(fulfillment.shopifyOrderId);
}

type AdminOrdersListResponse = {
  orders: {
    nodes: Array<{
      id: string;
      name: string;
      createdAt: string;
      displayFinancialStatus: string;
      displayFulfillmentStatus: string;
      totalPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
};

const ORDERS_BY_EMAIL_QUERY = `#graphql
  query OrdersByEmail($query: String!, $first: Int!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapOrderListItem(
  order: AdminOrdersListResponse["orders"]["nodes"][number],
): OrderListItem {
  return {
    id: order.id,
    name: order.name,
    createdAt: order.createdAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    total: order.totalPriceSet.shopMoney,
  };
}

export async function listShopifyOrdersByEmail(
  email: string,
): Promise<OrderListItem[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const data = await adminGraphql<AdminOrdersListResponse>(
    ORDERS_BY_EMAIL_QUERY,
    {
      query: `email:${normalizedEmail}`,
      first: 20,
    },
    { operation: "ordersByEmail" },
  );

  return data.orders.nodes.map(mapOrderListItem);
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
