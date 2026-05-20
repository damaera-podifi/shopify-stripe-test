import { NextResponse } from "next/server";
import { fulfillStripePayment } from "@/lib/checkout/fulfillment";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export async function POST(request: Request) {
  let paymentIntentId: string | undefined;

  try {
    const body = (await request.json()) as { paymentIntentId?: string };
    paymentIntentId = body.paymentIntentId?.trim();

    if (!paymentIntentId) {
      logCheckout("api_complete_bad_request", { reason: "missing paymentIntentId" });
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 },
      );
    }

    logCheckout("api_complete_start", { paymentIntentId });
    const result = await fulfillStripePayment(paymentIntentId);

    logCheckout("api_complete_ok", {
      paymentIntentId,
      shopifyOrderId: result.shopifyOrderId,
      shopifyOrderName: result.shopifyOrderName,
    });

    return NextResponse.json({
      shopifyOrderId: result.shopifyOrderId,
      shopifyOrderName: result.shopifyOrderName,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fulfillment failed";
    logCheckoutError("api_complete_failed", e, { paymentIntentId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
