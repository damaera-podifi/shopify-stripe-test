import Link from "next/link";
import { CartLineItem } from "@/components/store/cart-line-item";
import { CartTotalsSummary } from "@/components/store/cart-totals-summary";
import { DiscountCodeForm } from "@/components/store/discount-code-form";
import { getStoreSession } from "@/lib/auth/session";
import { getCart } from "@/lib/shopify/cart";

export const metadata = {
  title: "Cart | MLPA Health",
  description: "Your shopping cart",
};

export default async function CartPage() {
  const [cart, session] = await Promise.all([getCart(), getStoreSession()]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Your cart
      </h1>

      {!cart || cart.lines.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-zinc-600 dark:text-zinc-400">Your cart is empty.</p>
          <Link
            href="/store"
            className="mt-4 inline-block rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
          >
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <ul className="space-y-4">
            {cart.lines.map((line) => (
              <CartLineItem key={line.id} line={line} />
            ))}
          </ul>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            {session?.isMembershipActive ? (
              <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Signed in as a member. Member pricing applies when Shopify
                automatic discounts are configured.
              </p>
            ) : session ? (
              <p className="mb-4 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                Signed in with an inactive membership. Regular prices apply.
              </p>
            ) : null}
            <CartTotalsSummary
              cart={cart}
              showMembershipNote={!session}
              showTaxCalculatedAtCheckout
            />

            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <DiscountCodeForm discountCodes={cart.discountCodes} />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/store/checkout"
                className="flex flex-1 items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Proceed to checkout
              </Link>
              <Link
                href="/store"
                className="flex flex-1 items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
