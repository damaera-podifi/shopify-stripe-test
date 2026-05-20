import { adminGraphql } from "@/lib/shopify/admin";
import { addManyToCart } from "@/lib/shopify/cart";
import {
  getShopifyOrderDetailsForUser,
  normalizeEmail,
  type OrderDetails,
} from "./order-details";
import { logCheckout } from "./logger";
import {
  findPaymentIntentForShopifyOrder,
  refundStripePaymentIntent,
} from "./order-payment";

export type ReturnRequestItem = {
  fulfillmentLineItemId: string;
  quantity: number;
  returnReason: string;
  customerNote?: string;
};

async function loadAuthorizedOrder(
  shopifyOrderId: string,
  userId: string,
  loginEmail: string,
): Promise<OrderDetails> {
  const order = await getShopifyOrderDetailsForUser(
    shopifyOrderId,
    userId,
    loginEmail,
  );
  if (!order) {
    throw new Error("Order not found for your account");
  }
  return order;
}

async function fetchOrderNote(shopifyOrderId: string): Promise<string | null> {
  const data = await adminGraphql<{
    order: { note: string | null } | null;
  }>(
    `#graphql
      query OrderNote($id: ID!) {
        order(id: $id) {
          note
        }
      }
    `,
    { id: shopifyOrderId },
    { operation: "orderNote" },
  );

  return data.order?.note ?? null;
}

export async function reorderShopifyOrder(
  shopifyOrderId: string,
  userId: string,
  loginEmail: string,
) {
  const order = await loadAuthorizedOrder(shopifyOrderId, userId, loginEmail);

  if (!order.canReorder) {
    throw new Error("This order cannot be reordered");
  }

  const lines = order.lineItems
    .filter((item) => item.variantId)
    .map((item) => ({
      merchandiseId: item.variantId!,
      quantity: item.quantity,
    }));

  if (lines.length === 0) {
    throw new Error("No purchasable items found on this order");
  }

  logCheckout("order_reorder_start", {
    shopifyOrderId,
    userId,
    lineCount: lines.length,
  });

  const cart = await addManyToCart(lines);

  logCheckout("order_reorder_ok", {
    shopifyOrderId,
    cartId: cart.id,
    totalQuantity: cart.totalQuantity,
  });

  return cart;
}

export async function cancelShopifyOrder(
  shopifyOrderId: string,
  userId: string,
  loginEmail: string,
) {
  const order = await loadAuthorizedOrder(shopifyOrderId, userId, loginEmail);

  if (!order.canCancel) {
    throw new Error("This order cannot be cancelled");
  }

  const orderNote = await fetchOrderNote(shopifyOrderId);
  const paymentIntentId = await findPaymentIntentForShopifyOrder(
    shopifyOrderId,
    orderNote,
  );

  logCheckout("order_cancel_start", {
    shopifyOrderId,
    userId,
    paymentIntentId,
  });

  const cancelData = await adminGraphql<{
    orderCancel: {
      job: { id: string; done: boolean } | null;
      orderCancelUserErrors: Array<{ message: string }>;
    };
  }>(
    `#graphql
      mutation OrderCancel(
        $orderId: ID!
        $notifyCustomer: Boolean
        $refundMethod: OrderCancelRefundMethodInput!
        $restock: Boolean!
        $reason: OrderCancelReason!
        $staffNote: String
      ) {
        orderCancel(
          orderId: $orderId
          notifyCustomer: $notifyCustomer
          refundMethod: $refundMethod
          restock: $restock
          reason: $reason
          staffNote: $staffNote
        ) {
          job {
            id
            done
          }
          orderCancelUserErrors {
            field
            message
            code
          }
        }
      }
    `,
    {
      orderId: shopifyOrderId,
      notifyCustomer: true,
      refundMethod: {
        originalPaymentMethodsRefund: false,
      },
      restock: true,
      reason: "CUSTOMER",
      staffNote: `Cancelled by signed-in customer (${normalizeEmail(loginEmail)})`,
    },
    { operation: "orderCancel" },
  );

  const cancelErrors = cancelData.orderCancel.orderCancelUserErrors;
  if (cancelErrors.length) {
    throw new Error(cancelErrors.map((error) => error.message).join(", "));
  }

  const refund = await refundStripePaymentIntent(paymentIntentId);

  logCheckout("order_cancel_ok", {
    shopifyOrderId,
    paymentIntentId,
    refundId: refund.id,
    cancelJobId: cancelData.orderCancel.job?.id,
  });

  return {
    paymentIntentId,
    refundId: refund.id,
  };
}

export async function requestShopifyOrderReturn(
  shopifyOrderId: string,
  userId: string,
  loginEmail: string,
  items: ReturnRequestItem[],
) {
  const order = await loadAuthorizedOrder(shopifyOrderId, userId, loginEmail);

  if (!order.canRequestReturn) {
    throw new Error("This order is not eligible for a return request");
  }

  if (!items.length) {
    throw new Error("Select at least one item to return");
  }

  const allowedIds = new Set(
    order.returnableLineItems.map((item) => item.fulfillmentLineItemId),
  );

  for (const item of items) {
    if (!allowedIds.has(item.fulfillmentLineItemId)) {
      throw new Error("One or more selected items are not returnable");
    }
  }

  logCheckout("order_return_request_start", {
    shopifyOrderId,
    userId,
    itemCount: items.length,
  });

  const returnData = await adminGraphql<{
    returnRequest: {
      return: {
        id: string;
        name: string;
        status: string;
      } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `#graphql
      mutation ReturnRequest($input: ReturnRequestInput!) {
        returnRequest(input: $input) {
          return {
            id
            name
            status
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
        orderId: shopifyOrderId,
        returnLineItems: items.map((item) => ({
          fulfillmentLineItemId: item.fulfillmentLineItemId,
          quantity: item.quantity,
          returnReason: item.returnReason,
          customerNote: item.customerNote?.trim() || undefined,
        })),
      },
    },
    { operation: "returnRequest" },
  );

  const userErrors = returnData.returnRequest.userErrors;
  if (userErrors.length) {
    throw new Error(userErrors.map((error) => error.message).join(", "));
  }

  const returnRecord = returnData.returnRequest.return;
  if (!returnRecord) {
    throw new Error("Failed to create return request");
  }

  logCheckout("order_return_request_ok", {
    shopifyOrderId,
    returnId: returnRecord.id,
    returnName: returnRecord.name,
    status: returnRecord.status,
  });

  return returnRecord;
}
