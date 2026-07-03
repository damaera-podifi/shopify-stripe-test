import type { Cart } from "./cart";
import {
  computeCartDisplaySubtotal,
  computeMembershipDiscountAmount,
  computeVoucherDiscountAmount,
} from "./cart-discounts";

export function computeCartPostDiscountSubtotal(cart: Cart): number {
  const displaySubtotal = computeCartDisplaySubtotal(cart);
  const membership = computeMembershipDiscountAmount(cart);
  const voucher = computeVoucherDiscountAmount(cart);
  return Math.max(0, displaySubtotal - membership - voucher);
}

export function computeCartTaxAmount(cart: Cart): number {
  if (cart.cost.totalTaxAmount) {
    const tax = Number(cart.cost.totalTaxAmount.amount);
    if (Number.isFinite(tax) && tax > 0) {
      return tax;
    }
  }

  const postDiscount = computeCartPostDiscountSubtotal(cart);
  const total = Number(cart.cost.totalAmount.amount);
  if (!Number.isFinite(total)) {
    return 0;
  }

  return Math.max(0, Math.round((total - postDiscount) * 100) / 100);
}

export function cartHasTaxEstimate(cart: Cart): boolean {
  return computeCartTaxAmount(cart) > 0.001;
}
