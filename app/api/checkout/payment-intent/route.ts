import { NextResponse } from "next/server";
import { getStoreSession } from "@/lib/auth/session";
import { createUserIdFromEmail } from "@/lib/auth/user-id";
import {
  buildCheckoutLineItemsFromCart,
  computeMembershipDiscountAmount,
} from "@/lib/checkout/cart-checkout";
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

    const lineItems = buildCheckoutLineItemsFromCart(cart);
    const membershipDiscountAmount = computeMembershipDiscountAmount(cart);

    const session = await getStoreSession();
    const appUserId =
      session?.userId ?? createUserIdFromEmail(shippingResult.email);

    let shopifyCustomerId = "";
    if (session?.isMembershipActive) {
      try {
        const { syncMembershipCustomerToShopify } = await import(
          "@/lib/shopify/membership"
        );
        const sync = await syncMembershipCustomerToShopify(
          session.email,
          true,
        );
        shopifyCustomerId = sync.shopifyCustomerId;
      } catch {
        // Checkout can proceed; fulfillment may fall back to email-only customer lookup.
      }
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: cart.cost.totalAmount.currencyCode.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: shippingResult.email,
      metadata: {
        cart_id: cart.id,
        line_items: JSON.stringify(lineItems),
        shipping: JSON.stringify(shippingResult),
        app_user_id: appUserId,
        is_membership_active: session?.isMembershipActive ? "true" : "false",
        membership_discount_amount: membershipDiscountAmount.toFixed(2),
        shopify_customer_id: shopifyCustomerId,
      },
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
