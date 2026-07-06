"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckoutForm } from "@/components/store/checkout-form";
import { CheckoutLineItem } from "@/components/store/checkout-line-item";
import { CartTotalsSummary } from "@/components/store/cart-totals-summary";
import { DiscountCodeForm } from "@/components/store/discount-code-form";
import type { CheckoutShippingInput, CheckoutTaxLine } from "@/lib/checkout/types";
import type { Cart } from "@/lib/shopify/cart";

type CheckoutPageClientProps = {
  initialCart: Cart;
  publishableKey: string;
  defaultShipping?: Partial<CheckoutShippingInput>;
  hasUnavailableItems: boolean;
};

export function CheckoutPageClient({
  initialCart,
  publishableKey,
  defaultShipping,
  hasUnavailableItems,
}: CheckoutPageClientProps) {
  const [cart, setCart] = useState(initialCart);
  const [checkoutTaxAmount, setCheckoutTaxAmount] = useState<number | null>(null);
  const [checkoutTaxLines, setCheckoutTaxLines] = useState<CheckoutTaxLine[] | null>(
    null,
  );
  const [checkoutShippingAmount, setCheckoutShippingAmount] = useState<number | null>(
    null,
  );
  const [checkoutShippingTitle, setCheckoutShippingTitle] = useState<string | null>(
    null,
  );
  const [checkoutTotalAmount, setCheckoutTotalAmount] = useState<string | null>(
    null,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        {hasUnavailableItems ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
            Remove unavailable items from your cart before checking out.
          </p>
        ) : null}
        <CheckoutForm
          key={`${cart.cost.totalAmount.amount}-${cart.discountCodes.map((entry) => entry.code).join(",")}`}
          publishableKey={publishableKey}
          currencyCode={cart.cost.totalAmount.currencyCode}
          totalAmount={cart.cost.totalAmount.amount}
          totalQuantity={cart.totalQuantity}
          disabled={hasUnavailableItems}
          defaultShipping={defaultShipping}
          onCheckoutTotals={(totals) => {
            setCheckoutTotalAmount(totals.totalAmount);
            if (totals.taxAmount != null) {
              const tax = Number(totals.taxAmount);
              setCheckoutTaxAmount(tax > 0.001 ? tax : null);
              setCheckoutTaxLines(
                totals.taxLines && totals.taxLines.length > 0
                  ? totals.taxLines
                  : null,
              );
            } else {
              setCheckoutTaxAmount(null);
              setCheckoutTaxLines(null);
            }
            if (totals.shippingAmount != null) {
              const shipping = Number(totals.shippingAmount);
              setCheckoutShippingAmount(Number.isFinite(shipping) ? shipping : null);
              setCheckoutShippingTitle(totals.shippingTitle ?? "Shipping");
            } else {
              setCheckoutShippingAmount(null);
              setCheckoutShippingTitle(null);
            }
          }}
        />
      </section>

      <aside className="rounded-2xl border border-zinc-200 bg-white p-6 lg:sticky lg:top-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Order summary
        </h2>
        <ul className="mt-4 max-h-64 space-y-0 overflow-y-auto">
          {cart.lines.map((line) => (
            <CheckoutLineItem key={line.id} line={line} />
          ))}
        </ul>
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <CartTotalsSummary
            cart={cart}
            showTaxCalculatedAtCheckout
            shippingAmountOverride={checkoutShippingAmount}
            shippingTitleOverride={checkoutShippingTitle}
            taxAmountOverride={checkoutTaxAmount}
            taxLinesOverride={checkoutTaxLines}
            totalAmountOverride={checkoutTotalAmount}
          />
        </div>
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <DiscountCodeForm
            discountCodes={cart.discountCodes}
            onCartUpdated={(updatedCart) => {
              setCart(updatedCart);
            }}
            compact
          />
        </div>
        <Link
          href="/store/cart"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Edit cart
        </Link>
      </aside>
    </div>
  );
}
