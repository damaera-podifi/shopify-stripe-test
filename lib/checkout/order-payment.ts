import { logCheckout, logCheckoutError } from "./logger";
import { getStripe } from "@/lib/stripe/server";

const PAYMENT_INTENT_NOTE_PATTERN =
  /Stripe PaymentIntent (pi_[A-Za-z0-9]+)/;

export function parsePaymentIntentIdFromOrderNote(note: string | null | undefined) {
  if (!note) return null;
  const match = note.match(PAYMENT_INTENT_NOTE_PATTERN);
  return match?.[1] ?? null;
}

export async function findPaymentIntentForShopifyOrder(
  shopifyOrderId: string,
  orderNote?: string | null,
): Promise<string> {
  const fromNote = parsePaymentIntentIdFromOrderNote(orderNote);
  if (fromNote) {
    return fromNote;
  }

  const stripe = getStripe();
  const query = `metadata['shopify_order_id']:'${shopifyOrderId}' AND status:'succeeded'`;

  try {
    logCheckout("stripe_payment_intent_search", { shopifyOrderId, query });
    const result = await stripe.paymentIntents.search({ query, limit: 1 });
    const paymentIntentId = result.data[0]?.id;
    if (paymentIntentId) {
      return paymentIntentId;
    }
  } catch (error) {
    logCheckoutError("stripe_payment_intent_search_failed", error, {
      shopifyOrderId,
    });
  }

  throw new Error("Could not find the Stripe payment for this order");
}

export async function refundStripePaymentIntent(paymentIntentId: string) {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment is not in a refundable state");
  }

  const existingRefunds = await stripe.refunds.list({
    payment_intent: paymentIntentId,
    limit: 1,
  });

  if (existingRefunds.data.length > 0) {
    logCheckout("stripe_refund_already_exists", {
      paymentIntentId,
      refundId: existingRefunds.data[0].id,
    });
    return existingRefunds.data[0];
  }

  logCheckout("stripe_refund_create_start", { paymentIntentId });
  const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  logCheckout("stripe_refund_create_ok", {
    paymentIntentId,
    refundId: refund.id,
    amount: refund.amount,
  });
  return refund;
}
