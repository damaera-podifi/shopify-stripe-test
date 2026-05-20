import { NextResponse } from "next/server";
import { requireStoreSession } from "@/lib/auth/session";
import { cancelShopifyOrder } from "@/lib/checkout/order-actions";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export async function POST(request: Request) {
  try {
    const session = await requireStoreSession();
    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    logCheckout("api_cancel_start", { orderId, userId: session.userId });
    const result = await cancelShopifyOrder(
      orderId,
      session.userId,
      session.email,
    );

    logCheckout("api_cancel_ok", {
      orderId,
      refundId: result.refundId,
      paymentIntentId: result.paymentIntentId,
    });

    return NextResponse.json({
      refundId: result.refundId,
      paymentIntentId: result.paymentIntentId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel order";
    const status = message === "You must be signed in" ? 401 : 500;
    logCheckoutError("api_cancel_failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
