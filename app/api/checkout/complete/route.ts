import { NextResponse } from "next/server";
import { fulfillStripePayment } from "@/lib/checkout/fulfillment";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { paymentIntentId?: string };
    const paymentIntentId = body.paymentIntentId?.trim();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 },
      );
    }

    const result = await fulfillStripePayment(paymentIntentId);

    return NextResponse.json({
      shopifyOrderId: result.shopifyOrderId,
      shopifyOrderName: result.shopifyOrderName,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fulfillment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
