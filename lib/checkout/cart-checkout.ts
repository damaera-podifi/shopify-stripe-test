import type { Cart } from "@/lib/shopify/cart";
import type { CheckoutLineItemMeta } from "./types";

/** Sum of per-line membership savings (subtotal − line total). */
export function computeMembershipDiscountAmount(cart: Cart): number {
  let discount = 0;

  for (const line of cart.lines) {
    const sub = Number(line.cost.subtotalAmount.amount);
    const tot = Number(line.cost.totalAmount.amount);
    discount += Math.max(0, sub - tot);
  }

  if (discount > 0) {
    return discount;
  }

  const cartSub = Number(cart.cost.subtotalAmount.amount);
  const cartTot = Number(cart.cost.totalAmount.amount);
  return Math.max(0, cartSub - cartTot);
}

/** Snapshot line pricing at checkout so fulfillment matches what Stripe charged. */
export function buildCheckoutLineItemsFromCart(cart: Cart): CheckoutLineItemMeta[] {
  return cart.lines.map((line) => {
    const quantity = line.quantity;
    const lineTotal = Number(line.cost.totalAmount.amount);
    const lineSubtotal = Number(line.cost.subtotalAmount.amount);
    const unitPrice = quantity > 0 ? lineTotal / quantity : lineTotal;
    const originalUnitPrice =
      quantity > 0 ? lineSubtotal / quantity : lineSubtotal;
    const hasMemberDiscount = lineTotal < lineSubtotal - 0.001;

    return {
      variantId: line.merchandise.id,
      quantity,
      ...(hasMemberDiscount
        ? {
            unitPrice: unitPrice.toFixed(2),
            originalUnitPrice: originalUnitPrice.toFixed(2),
            currencyCode: line.cost.totalAmount.currencyCode,
          }
        : {}),
    };
  });
}
