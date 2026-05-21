import type { Cart } from "@/lib/shopify/cart";
import { formatPrice } from "@/lib/shopify/products";

export function CartTotalsSummary({
  cart,
  showMembershipNote = false,
}: {
  cart: Cart;
  showMembershipNote?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>Subtotal</span>
        <span>
          {formatPrice(
            cart.cost.subtotalAmount.amount,
            cart.cost.subtotalAmount.currencyCode,
          )}
        </span>
      </div>
      {cart.discountTotal ? (
        <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-400">
          <span>Membership discount</span>
          <span>
            -
            {formatPrice(
              cart.discountTotal.amount,
              cart.discountTotal.currencyCode,
            )}
          </span>
        </div>
      ) : showMembershipNote ? (
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
