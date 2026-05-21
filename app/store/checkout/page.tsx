import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/store/checkout-form";
import { CheckoutLineItem } from "@/components/store/checkout-line-item";
import { getStoreSession } from "@/lib/auth/session";
import { getStripePublishableKey } from "@/lib/stripe/config";
import { getCart } from "@/lib/shopify/cart";
import { formatPrice } from "@/lib/shopify/products";

export const metadata = {
  title: "Checkout | MLPA Health",
  description: "Complete your purchase",
};

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getCart(), getStoreSession()]);

  if (!cart || cart.lines.length === 0) {
    redirect("/store/cart");
  }

  const hasUnavailableItems = cart.lines.some(
    (line) => !line.merchandise.availableForSale,
  );

  let publishableKey: string;
  try {
    publishableKey = getStripePublishableKey();
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and
          STRIPE_SECRET_KEY to your environment.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Checkout
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter shipping details and pay securely with Stripe. Your order is
          created in Shopify after payment succeeds.
          {session ? (
            <>
              {" "}
              Signed in as{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {session.email}
              </span>
              ; you can use a different contact email below.
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          {hasUnavailableItems ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
              Remove unavailable items from your cart before checking out.
            </p>
          ) : null}
          <CheckoutForm
            publishableKey={publishableKey}
            currencyCode={cart.cost.totalAmount.currencyCode}
            totalAmount={cart.cost.totalAmount.amount}
            totalQuantity={cart.totalQuantity}
            disabled={hasUnavailableItems}
            defaultEmail={session?.email ?? ""}
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
          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-lg font-semibold dark:border-zinc-800">
            <span>Total ({cart.totalQuantity} items)</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              {formatPrice(
                cart.cost.totalAmount.amount,
                cart.cost.totalAmount.currencyCode,
              )}
            </span>
          </div>
          <Link
            href="/store/cart"
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Edit cart
          </Link>
        </aside>
      </div>
    </main>
  );
}
