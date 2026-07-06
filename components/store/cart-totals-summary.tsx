import type { Cart } from "@/lib/shopify/cart";
import type { CheckoutTaxLine } from "@/lib/checkout/types";
import { formatTaxLineLabel } from "@/lib/checkout/format-tax-rate";
import {
  computeCartDisplaySubtotal,
  computeMembershipDiscountAmount,
  computeVoucherDiscountAmount,
  getVoucherDiscountLabel,
} from "@/lib/shopify/cart-discounts";
import { computeCartTaxAmount } from "@/lib/shopify/cart-tax";
import { formatPrice } from "@/lib/shopify/products";

export function CartTotalsSummary({
  cart,
  showMembershipNote = false,
  showTaxCalculatedAtCheckout = false,
  taxAmountOverride,
  taxLinesOverride,
  totalAmountOverride,
}: {
  cart: Cart;
  showMembershipNote?: boolean;
  showTaxCalculatedAtCheckout?: boolean;
  taxAmountOverride?: number | null;
  taxLinesOverride?: CheckoutTaxLine[] | null;
  totalAmountOverride?: string | null;
}) {
  const membershipDiscount = computeMembershipDiscountAmount(cart);
  const voucherDiscount = computeVoucherDiscountAmount(cart);
  const voucherLabel = getVoucherDiscountLabel(cart);
  const currencyCode = cart.cost.totalAmount.currencyCode;
  const displaySubtotal = computeCartDisplaySubtotal(cart);
  const taxAmount =
    taxAmountOverride ?? computeCartTaxAmount(cart);
  const totalAmount =
    totalAmountOverride ?? cart.cost.totalAmount.amount;
  const taxLines = taxLinesOverride ?? [];

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
      {taxLines.length > 0 ? (
        taxLines.map((line) => (
          <div
            key={line.title}
            className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400"
          >
            <span>{formatTaxLineLabel(line.title, line.rate)}</span>
            <span>{formatPrice(line.amount, currencyCode)}</span>
          </div>
        ))
      ) : taxAmount > 0.001 ? (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>Tax</span>
          <span>{formatPrice(taxAmount.toFixed(2), currencyCode)}</span>
        </div>
      ) : showTaxCalculatedAtCheckout ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tax calculated at checkout based on your shipping address.
        </p>
      ) : null}
      {membershipDiscount <= 0 && voucherDiscount <= 0 && showMembershipNote ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with an active membership to unlock member pricing.
        </p>
      ) : null}
      <div className="flex items-center justify-between text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span>Total ({cart.totalQuantity} items)</span>
        <span className="text-emerald-700 dark:text-emerald-400">
          {formatPrice(totalAmount, currencyCode)}
        </span>
      </div>
    </div>
  );
}
