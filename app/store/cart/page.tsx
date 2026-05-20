import Link from "next/link";
import { CartLineItem } from "@/components/store/cart-line-item";
import { getCart } from "@/lib/shopify/cart";
import { formatPrice } from "@/lib/shopify/products";

export const metadata = {
  title: "Cart | MLPA Health",
  description: "Your shopping cart",
};

export default async function CartPage() {
  const cart = await getCart();

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
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>
                {formatPrice(
                  cart.cost.subtotalAmount.amount,
                  cart.cost.subtotalAmount.currencyCode,
                )}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              <span>Total ({cart.totalQuantity} items)</span>
              <span className="text-emerald-700 dark:text-emerald-400">
                {formatPrice(
                  cart.cost.totalAmount.amount,
                  cart.cost.totalAmount.currencyCode,
                )}
              </span>
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
