import { NextResponse } from "next/server";
import { requireStoreSession } from "@/lib/auth/session";
import {
  requestShopifyOrderReturn,
  type ReturnRequestItem,
} from "@/lib/checkout/order-actions";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export async function POST(request: Request) {
  try {
    const session = await requireStoreSession();
    const body = (await request.json()) as {
      orderId?: string;
      items?: ReturnRequestItem[];
    };

    const orderId = body.orderId?.trim();
    const items = body.items ?? [];

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    logCheckout("api_return_start", {
      orderId,
      userId: session.userId,
      itemCount: items.length,
    });
    const result = await requestShopifyOrderReturn(
      orderId,
      session.userId,
      session.email,
      items,
    );

    logCheckout("api_return_ok", {
      orderId,
      returnId: result.id,
      returnName: result.name,
      status: result.status,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to request return";
    const status = message === "You must be signed in" ? 401 : 500;
    logCheckoutError("api_return_failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
