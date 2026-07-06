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
  shippingAmountOverride,
  shippingTitleOverride,
  taxAmountOverride,
  taxLinesOverride,
  totalAmountOverride,
}: {
  cart: Cart;
  showMembershipNote?: boolean;
  showTaxCalculatedAtCheckout?: boolean;
  shippingAmountOverride?: number | null;
  shippingTitleOverride?: string | null;
  taxAmountOverride?: number | null;
  taxLinesOverride?: CheckoutTaxLine[] | null;
  totalAmountOverride?: string | null;
}) {
  const membershipDiscount = computeMembershipDiscountAmount(cart);
  const voucherDiscount = computeVoucherDiscountAmount(cart);
  const voucherLabel = getVoucherDiscountLabel(cart);
  const currencyCode = cart.cost.totalAmount.currencyCode;
  const displaySubtotal = computeCartDisplaySubtotal(cart);
  const shippingAmount = shippingAmountOverride ?? null;
  const shippingTitle = shippingTitleOverride ?? "Shipping";
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
      {shippingAmount != null ? (
        <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Shipping
          </p>
          <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
            <span>{shippingTitle}</span>
            <span>{formatPrice(shippingAmount.toFixed(2), currencyCode)}</span>
          </div>
        </div>
      ) : showTaxCalculatedAtCheckout ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Shipping and tax calculated at checkout based on your address.
        </p>
      ) : null}
      {taxLines.length > 0 || taxAmount > 0.001 ? (
        <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Tax
          </p>
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
          ) : (
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>Estimated tax</span>
              <span>{formatPrice(taxAmount.toFixed(2), currencyCode)}</span>
            </div>
          )}
        </div>
      ) : null}
      {membershipDiscount <= 0 && voucherDiscount <= 0 && showMembershipNote ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with an active membership to unlock member pricing.
        </p>
      ) : null}
      <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-lg font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
        <span>Total ({cart.totalQuantity} items)</span>
        <span className="text-emerald-700 dark:text-emerald-400">
          {formatPrice(totalAmount, currencyCode)}
        </span>
      </div>
    </div>
  );
}
