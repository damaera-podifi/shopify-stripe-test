import { NextResponse } from "next/server";
import { fulfillStripePayment } from "@/lib/checkout/fulfillment";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";
import { getStripe } from "@/lib/stripe/server";
import { getStripeWebhookSecret } from "@/lib/stripe/config";

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    logCheckout("webhook_payment_intent_succeeded", {
      paymentIntentId: paymentIntent.id,
    });
    try {
      await fulfillStripePayment(paymentIntent.id);
      logCheckout("webhook_fulfillment_ok", {
        paymentIntentId: paymentIntent.id,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Fulfillment failed";
      logCheckoutError("webhook_fulfillment_failed", e, {
        paymentIntentId: paymentIntent.id,
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
