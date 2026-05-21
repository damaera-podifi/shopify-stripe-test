import type Stripe from "stripe";
import { logCheckout, logCheckoutError } from "./logger";
import type { CheckoutLineItemMeta, CheckoutShippingInput } from "./types";
import { attachAppUserIdToOrder } from "./order-ownership";
import { createUserIdFromEmail } from "@/lib/auth/user-id";
import { clearCartIdCookie, getCartIdFromCookie } from "@/lib/shopify/cart-cookie";
import { adminGraphql } from "@/lib/shopify/admin";
import { getStripe } from "@/lib/stripe/server";

export type FulfillmentResult = {
  shopifyOrderId: string;
  shopifyOrderName: string | null;
};

function parseLineItems(metadata: Stripe.Metadata): CheckoutLineItemMeta[] {
  const raw = metadata.line_items;
  if (!raw) {
    throw new Error("Payment is missing line item metadata");
  }
  const parsed = JSON.parse(raw) as CheckoutLineItemMeta[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Payment has invalid line item metadata");
  }
  return parsed;
}

function parseShipping(metadata: Stripe.Metadata): CheckoutShippingInput {
  const raw = metadata.shipping;
  if (!raw) {
    throw new Error("Payment is missing shipping metadata");
  }
  return JSON.parse(raw) as CheckoutShippingInput;
}

function mailingAddress(shipping: CheckoutShippingInput) {
  return {
    firstName: shipping.firstName,
    lastName: shipping.lastName,
    address1: shipping.address1,
    address2: shipping.address2 || undefined,
    city: shipping.city,
    provinceCode: shipping.province,
    countryCode: shipping.country,
    zip: shipping.zip,
  };
}

async function createAndCompleteDraftOrder(
  shipping: CheckoutShippingInput,
  lineItems: CheckoutLineItemMeta[],
  paymentIntentId: string,
  options?: {
    shopifyCustomerId?: string;
    membershipDiscountAmount?: number;
  },
): Promise<FulfillmentResult> {
  logCheckout("draft_order_create_start", {
    paymentIntentId,
    email: shipping.email,
    lineItemCount: lineItems.length,
    variantIds: lineItems.map((item) => item.variantId),
    membershipDiscountAmount: options?.membershipDiscountAmount ?? 0,
  });

  const membershipDiscountAmount = options?.membershipDiscountAmount ?? 0;

  const createMutation = `#graphql
    mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const createData = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: { id: string } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    createMutation,
    {
      input: {
        email: shipping.email,
        ...(options?.shopifyCustomerId
          ? { customerId: options.shopifyCustomerId }
          : {}),
        note: `Paid via Stripe PaymentIntent ${paymentIntentId}`,
        lineItems: lineItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        ...(membershipDiscountAmount > 0
          ? {
              appliedDiscount: {
                title: "Membership pricing",
                description: "Automatic membership discount",
                value: membershipDiscountAmount,
                valueType: "FIXED_AMOUNT",
              },
            }
          : {}),
        shippingAddress: mailingAddress(shipping),
        billingAddress: mailingAddress(shipping),
      },
    },
    { operation: "draftOrderCreate" },
  );

  const createErrors = createData.draftOrderCreate.userErrors;
  if (createErrors.length) {
    logCheckoutError("draft_order_create_user_errors", new Error("userErrors"), {
      paymentIntentId,
      userErrors: createErrors,
    });
    throw new Error(createErrors.map((e) => e.message).join(", "));
  }

  const draftOrderId = createData.draftOrderCreate.draftOrder?.id;
  if (!draftOrderId) {
    logCheckoutError("draft_order_create_missing_id", new Error("no draft order"), {
      paymentIntentId,
    });
    throw new Error("Failed to create Shopify draft order");
  }

  logCheckout("draft_order_create_ok", { paymentIntentId, draftOrderId });

  logCheckout("draft_order_complete_start", { paymentIntentId, draftOrderId });

  const completeMutation = `#graphql
    mutation DraftOrderComplete($id: ID!) {
      draftOrderComplete(id: $id) {
        draftOrder {
          order {
            id
            name
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const completeData = await adminGraphql<{
    draftOrderComplete: {
      draftOrder: { order: { id: string; name: string } | null } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(completeMutation, { id: draftOrderId }, { operation: "draftOrderComplete" });

  const completeErrors = completeData.draftOrderComplete.userErrors;
  if (completeErrors.length) {
    logCheckoutError("draft_order_complete_user_errors", new Error("userErrors"), {
      paymentIntentId,
      draftOrderId,
      userErrors: completeErrors,
    });
    throw new Error(completeErrors.map((e) => e.message).join(", "));
  }

  const order = completeData.draftOrderComplete.draftOrder?.order;
  if (!order) {
    logCheckoutError("draft_order_complete_missing_order", new Error("no order"), {
      paymentIntentId,
      draftOrderId,
    });
    throw new Error("Failed to complete Shopify draft order");
  }

  logCheckout("draft_order_complete_ok", {
    paymentIntentId,
    shopifyOrderId: order.id,
    shopifyOrderName: order.name,
  });

  return {
    shopifyOrderId: order.id,
    shopifyOrderName: order.name,
  };
}

export async function fulfillStripePayment(
  paymentIntentId: string,
): Promise<FulfillmentResult> {
  logCheckout("fulfillment_start", { paymentIntentId });

  try {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    logCheckout("fulfillment_payment_intent", {
      paymentIntentId,
      status: paymentIntent.status,
      hasShopifyOrder: Boolean(paymentIntent.metadata.shopify_order_id),
      metadataKeys: Object.keys(paymentIntent.metadata),
    });

    if (paymentIntent.status !== "succeeded") {
      throw new Error("Payment has not succeeded yet");
    }

    if (paymentIntent.metadata.shopify_order_id) {
      logCheckout("fulfillment_already_done", {
        paymentIntentId,
        shopifyOrderId: paymentIntent.metadata.shopify_order_id,
        shopifyOrderName: paymentIntent.metadata.shopify_order_name,
      });
      return {
        shopifyOrderId: paymentIntent.metadata.shopify_order_id,
        shopifyOrderName: paymentIntent.metadata.shopify_order_name || null,
      };
    }

    const lineItems = parseLineItems(paymentIntent.metadata);
    const shipping = parseShipping(paymentIntent.metadata);
    const appUserId =
      paymentIntent.metadata.app_user_id?.trim() ||
      createUserIdFromEmail(shipping.email);
    const membershipDiscountAmount = Number(
      paymentIntent.metadata.membership_discount_amount ?? "0",
    );

    const result = await createAndCompleteDraftOrder(
      shipping,
      lineItems,
      paymentIntentId,
      {
        shopifyCustomerId:
          paymentIntent.metadata.shopify_customer_id?.trim() || undefined,
        membershipDiscountAmount: Number.isFinite(membershipDiscountAmount)
          ? membershipDiscountAmount
          : 0,
      },
    );

    await attachAppUserIdToOrder(result.shopifyOrderId, appUserId);

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        shopify_order_id: result.shopifyOrderId,
        shopify_order_name: result.shopifyOrderName ?? "",
        app_user_id: appUserId,
      },
    });

    const cartId = paymentIntent.metadata.cart_id;
    const cookieCartId = await getCartIdFromCookie();
    if (cartId && cookieCartId === cartId) {
      await clearCartIdCookie();
    }

    logCheckout("fulfillment_ok", {
      paymentIntentId,
      shopifyOrderId: result.shopifyOrderId,
      shopifyOrderName: result.shopifyOrderName,
    });

    return result;
  } catch (error) {
    logCheckoutError("fulfillment_failed", error, { paymentIntentId });
    throw error;
  }
}
