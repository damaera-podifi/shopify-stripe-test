import type { Cart } from "@/lib/shopify/cart";
import { lineDiscountBySource } from "@/lib/shopify/cart-discounts";
import type { CheckoutLineItemMeta } from "./types";

export {
  computeMembershipDiscountAmount,
  computeVoucherDiscountAmount,
  getApplicableVoucherCodes,
} from "@/lib/shopify/cart-discounts";

/** Snapshot line pricing at checkout so fulfillment matches what Stripe charged. */
export function buildCheckoutLineItemsFromCart(cart: Cart): CheckoutLineItemMeta[] {
  return cart.lines.map((line) => {
    const quantity = line.quantity;
    const lineSubtotal = Number(line.cost.subtotalAmount.amount);
    const membershipOnLine = lineDiscountBySource(line, "automatic");
    const hasMemberDiscount = membershipOnLine > 0.001;
    const safeQuantity = quantity > 0 ? quantity : 1;

    return {
      variantId: line.merchandise.id,
      quantity,
      ...(hasMemberDiscount
        ? {
            unitPrice: (
              (lineSubtotal - membershipOnLine) /
              safeQuantity
            ).toFixed(2),
            originalUnitPrice: (lineSubtotal / safeQuantity).toFixed(2),
            currencyCode: line.cost.totalAmount.currencyCode,
          }
        : {}),
    };
  });
}
