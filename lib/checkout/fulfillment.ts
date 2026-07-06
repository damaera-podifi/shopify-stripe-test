import type Stripe from "stripe";
import { logCheckout, logCheckoutError } from "./logger";
import {
  buildDraftOrderLineItemInput,
  buildDraftOrderNote,
  buildOrderLevelAppliedDiscount,
  lineMembershipDiscountAmount,
  totalMembershipDiscountFromLines,
} from "./draft-order-lines";
import type { CheckoutLineItemMeta, CheckoutShippingInput } from "./types";
import { attachAppUserIdToOrder } from "./order-ownership";
import { createUserIdFromEmail } from "@/lib/auth/user-id";
import { clearCartIdCookie } from "@/lib/shopify/cart-cookie";
import { revalidateCartCount } from "@/lib/shopify/cart";
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
    voucherDiscountAmount?: number;
    discountCodes?: string[];
    shippingRateHandle?: string;
    shippingTitle?: string;
    shippingAmount?: string;
  },
): Promise<FulfillmentResult> {
  logCheckout("draft_order_create_start", {
    paymentIntentId,
    email: shipping.email,
    lineItemCount: lineItems.length,
    variantIds: lineItems.map((item) => item.variantId),
    membershipDiscountAmount: options?.membershipDiscountAmount ?? 0,
    lineMembershipDiscounts: lineItems
      .map((item) => ({
        variantId: item.variantId,
        unitPrice: item.unitPrice,
        originalUnitPrice: item.originalUnitPrice,
        lineDiscount: totalMembershipDiscountFromLines([item]),
      }))
      .filter((item) => item.lineDiscount > 0),
  });

  const membershipDiscountAmount =
    options?.membershipDiscountAmount ??
    totalMembershipDiscountFromLines(lineItems);
  const voucherDiscountAmount = options?.voucherDiscountAmount ?? 0;
  const discountCodes = options?.discountCodes ?? [];
  const hasLineDiscounts = lineItems.some(
    (item) =>
      item.unitPrice &&
      item.originalUnitPrice &&
      lineMembershipDiscountAmount(item) > 0,
  );
  const orderLevelAppliedDiscount = buildOrderLevelAppliedDiscount({
    membershipDiscountAmount,
    voucherDiscountAmount,
    discountCodes,
    hasLineDiscounts,
  });

  const shippingLine =
    options?.shippingRateHandle
      ? { shippingRateHandle: options.shippingRateHandle }
      : options?.shippingTitle && options?.shippingAmount
        ? {
            title: options.shippingTitle,
            price: options.shippingAmount,
          }
        : undefined;

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
        note: buildDraftOrderNote(paymentIntentId, lineItems, {
          voucherDiscountAmount,
          discountCodes,
        }),
        ...((membershipDiscountAmount > 0 || voucherDiscountAmount > 0) && {
          tags: [
            ...(membershipDiscountAmount > 0 ? ["membership-pricing"] : []),
            ...(voucherDiscountAmount > 0 ? ["promo-code"] : []),
          ],
          customAttributes: [
            ...(membershipDiscountAmount > 0
              ? [
                  { key: "pricing_type", value: "membership" },
                  {
                    key: "membership_discount_total",
                    value: membershipDiscountAmount.toFixed(2),
                  },
                ]
              : []),
            ...(voucherDiscountAmount > 0
              ? [
                  {
                    key: "voucher_discount_total",
                    value: voucherDiscountAmount.toFixed(2),
                  },
                  {
                    key: "discount_codes",
                    value: discountCodes.join(", "),
                  },
                ]
              : []),
          ],
        }),
        lineItems: lineItems.map((item) => buildDraftOrderLineItemInput(item)),
        ...(orderLevelAppliedDiscount
          ? { appliedDiscount: orderLevelAppliedDiscount }
          : {}),
        ...(shippingLine ? { shippingLine } : {}),
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
    const voucherDiscountAmount = Number(
      paymentIntent.metadata.voucher_discount_amount ?? "0",
    );
    let discountCodes: string[] = [];
    try {
      const parsed = JSON.parse(
        paymentIntent.metadata.discount_codes ?? "[]",
      ) as unknown;
      if (Array.isArray(parsed)) {
        discountCodes = parsed.filter((code) => typeof code === "string");
      }
    } catch {
      discountCodes = [];
    }

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
        voucherDiscountAmount: Number.isFinite(voucherDiscountAmount)
          ? voucherDiscountAmount
          : 0,
        discountCodes,
        shippingRateHandle:
          paymentIntent.metadata.shipping_rate_handle?.trim() || undefined,
        shippingTitle: paymentIntent.metadata.shipping_title?.trim() || undefined,
        shippingAmount: paymentIntent.metadata.shipping_amount?.trim() || undefined,
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

    await clearCartIdCookie();
    revalidateCartCount();

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
