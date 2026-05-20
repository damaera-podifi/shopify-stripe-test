import type Stripe from "stripe";
import type { CheckoutLineItemMeta, CheckoutShippingInput } from "./types";
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
): Promise<FulfillmentResult> {
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
      userErrors: Array<{ message: string }>;
    };
  }>(createMutation, {
    input: {
      email: shipping.email,
      note: `Paid via Stripe PaymentIntent ${paymentIntentId}`,
      lineItems: lineItems.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      shippingAddress: mailingAddress(shipping),
      billingAddress: mailingAddress(shipping),
    },
  });

  const createErrors = createData.draftOrderCreate.userErrors;
  if (createErrors.length) {
    throw new Error(createErrors.map((e) => e.message).join(", "));
  }

  const draftOrderId = createData.draftOrderCreate.draftOrder?.id;
  if (!draftOrderId) {
    throw new Error("Failed to create Shopify draft order");
  }

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
      userErrors: Array<{ message: string }>;
    };
  }>(completeMutation, { id: draftOrderId });

  const completeErrors = completeData.draftOrderComplete.userErrors;
  if (completeErrors.length) {
    throw new Error(completeErrors.map((e) => e.message).join(", "));
  }

  const order = completeData.draftOrderComplete.draftOrder?.order;
  if (!order) {
    throw new Error("Failed to complete Shopify draft order");
  }

  return {
    shopifyOrderId: order.id,
    shopifyOrderName: order.name,
  };
}

export async function fulfillStripePayment(
  paymentIntentId: string,
): Promise<FulfillmentResult> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment has not succeeded yet");
  }

  if (paymentIntent.metadata.shopify_order_id) {
    return {
      shopifyOrderId: paymentIntent.metadata.shopify_order_id,
      shopifyOrderName: paymentIntent.metadata.shopify_order_name || null,
    };
  }

  const lineItems = parseLineItems(paymentIntent.metadata);
  const shipping = parseShipping(paymentIntent.metadata);
  const result = await createAndCompleteDraftOrder(
    shipping,
    lineItems,
    paymentIntentId,
  );

  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      ...paymentIntent.metadata,
      shopify_order_id: result.shopifyOrderId,
      shopify_order_name: result.shopifyOrderName ?? "",
    },
  });

  const cartId = paymentIntent.metadata.cart_id;
  const cookieCartId = await getCartIdFromCookie();
  if (cartId && cookieCartId === cartId) {
    await clearCartIdCookie();
  }

  return result;
}
