import { NextResponse } from "next/server";
import { getStoreSession } from "@/lib/auth/session";
import { createUserIdFromEmail } from "@/lib/auth/user-id";
import {
  buildCheckoutLineItemsFromCart,
  computeMembershipDiscountAmount,
  computeVoucherDiscountAmount,
  getApplicableVoucherCodes,
} from "@/lib/checkout/cart-checkout";
import { calculateCheckoutTotals } from "@/lib/checkout/calculate-checkout-totals";
import {
  parseShippingFromBody,
  ShippingAddressValidationError,
  validateShippingAddressWithShopify,
} from "@/lib/checkout/validate-shipping";
import { getCart } from "@/lib/shopify/cart";
import { computeCartPostDiscountSubtotal } from "@/lib/shopify/cart-tax";
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

    await validateShippingAddressWithShopify(shippingResult);

    const lineItems = buildCheckoutLineItemsFromCart(cart);
    const membershipDiscountAmount = computeMembershipDiscountAmount(cart);
    const voucherDiscountAmount = computeVoucherDiscountAmount(cart);
    const discountCodes = getApplicableVoucherCodes(cart);

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

    const checkoutTotals = await calculateCheckoutTotals(
      shippingResult,
      lineItems,
      {
        shopifyCustomerId: shopifyCustomerId || undefined,
        membershipDiscountAmount,
        voucherDiscountAmount,
        discountCodes,
        postDiscountSubtotal: computeCartPostDiscountSubtotal(cart),
      },
    );

    const amount = Math.round(Number(checkoutTotals.totalAmount) * 100);

    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json({ error: "Invalid cart total" }, { status: 400 });
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: checkoutTotals.currencyCode.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      receipt_email: shippingResult.email,
      metadata: {
        cart_id: cart.id,
        line_items: JSON.stringify(lineItems),
        shipping: JSON.stringify(shippingResult),
        app_user_id: appUserId,
        is_membership_active: session?.isMembershipActive ? "true" : "false",
        membership_discount_amount: membershipDiscountAmount.toFixed(2),
        voucher_discount_amount: voucherDiscountAmount.toFixed(2),
        discount_codes: JSON.stringify(discountCodes),
        shopify_customer_id: shopifyCustomerId,
        tax_amount: checkoutTotals.taxAmount,
      },
    });

    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        { error: "Failed to create payment session" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      totalAmount: checkoutTotals.totalAmount,
      taxAmount: checkoutTotals.taxAmount,
      taxLines: checkoutTotals.taxLines,
      currencyCode: checkoutTotals.currencyCode,
    });
  } catch (e) {
    if (e instanceof ShippingAddressValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
