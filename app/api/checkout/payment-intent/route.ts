import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { parseShippingFromBody } from "@/lib/checkout/validate-shipping";
import { getCart } from "@/lib/shopify/cart";
import { getStripe } from "@/lib/stripe/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const shippingResult = parseShippingFromBody(body);

    if ("error" in shippingResult) {
      return NextResponse.json({ error: shippingResult.error }, { status: 400 });
    }

    const cart = await getCart();
    if (!cart || cart.lines.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const hasUnavailable = cart.lines.some(
      (line) => !line.merchandise.availableForSale,
    );
    if (hasUnavailable) {
      return NextResponse.json(
        { error: "Cart contains unavailable items" },
        { status: 400 },
      );
    }

    const amount = Math.round(
      Number(cart.cost.totalAmount.amount) * 100,
    );
    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: "Invalid cart total" }, { status: 400 });
    }

    const lineItems = cart.lines.map((line) => ({
      variantId: line.merchandise.id,
      quantity: line.quantity,
    }));

    const user = await getSessionUser();
    const metadata: Record<string, string> = {
      cart_id: cart.id,
      line_items: JSON.stringify(lineItems),
      shipping: JSON.stringify(shippingResult),
    };
    if (user?.shopifyCustomerId) {
      metadata.shopify_customer_id = user.shopifyCustomerId;
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: cart.cost.totalAmount.currencyCode.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: shippingResult.email,
      metadata,
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Failed to create payment session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
