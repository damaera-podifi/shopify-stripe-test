import type { Cart } from "@/lib/shopify/cart";
import {
  computeCartDisplaySubtotal,
  computeMembershipDiscountAmount,
  computeVoucherDiscountAmount,
  getVoucherDiscountLabel,
} from "@/lib/shopify/cart-discounts";
import { formatPrice } from "@/lib/shopify/products";

export function CartTotalsSummary({
  cart,
  showMembershipNote = false,
}: {
  cart: Cart;
  showMembershipNote?: boolean;
}) {
  const membershipDiscount = computeMembershipDiscountAmount(cart);
  const voucherDiscount = computeVoucherDiscountAmount(cart);
  const voucherLabel = getVoucherDiscountLabel(cart);
  const currencyCode = cart.cost.totalAmount.currencyCode;
  const displaySubtotal = computeCartDisplaySubtotal(cart);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>Subtotal</span>
        <span>{formatPrice(displaySubtotal.toFixed(2), currencyCode)}</span>
      </div>
      {membershipDiscount > 0 ? (
        <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
          <span>Membership discount</span>
          <span>-{formatPrice(membershipDiscount.toFixed(2), currencyCode)}</span>
        </div>
      ) : null}
      {voucherDiscount > 0 ? (
        <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
          <span>{voucherLabel}</span>
          <span>-{formatPrice(voucherDiscount.toFixed(2), currencyCode)}</span>
        </div>
      ) : null}
      {membershipDiscount <= 0 && voucherDiscount <= 0 && showMembershipNote ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with an active membership to unlock member pricing.
        </p>
      ) : null}
      <div className="flex items-center justify-between text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span>Total ({cart.totalQuantity} items)</span>
        <span className="text-emerald-700 dark:text-emerald-400">
          {formatPrice(
            cart.cost.totalAmount.amount,
            cart.cost.totalAmount.currencyCode,
          )}
        </span>
      </div>
    </div>
  );
}
