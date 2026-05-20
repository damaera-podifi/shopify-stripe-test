import { NextResponse } from "next/server";
import { requireStoreSession } from "@/lib/auth/session";
import { reorderShopifyOrder } from "@/lib/checkout/order-actions";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export async function POST(request: Request) {
  try {
    const session = await requireStoreSession();
    const body = (await request.json()) as { orderId?: string };
    const orderId = body.orderId?.trim();

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    logCheckout("api_reorder_start", { orderId, userId: session.userId });
    const cart = await reorderShopifyOrder(
      orderId,
      session.userId,
      session.email,
    );

    logCheckout("api_reorder_ok", {
      orderId,
      cartId: cart.id,
      totalQuantity: cart.totalQuantity,
    });

    return NextResponse.json({
      cartId: cart.id,
      totalQuantity: cart.totalQuantity,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reorder items";
    const status = message === "You must be signed in" ? 401 : 500;
    logCheckoutError("api_reorder_failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
