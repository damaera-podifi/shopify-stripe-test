import Image from "next/image";
import Link from "next/link";
import {
  removeCartLineAction,
  updateCartLineAction,
} from "@/app/store/actions/cart";
import type { CartLine } from "@/lib/shopify/cart";
import { formatPrice } from "@/lib/shopify/products";

export function CartLineItem({ line }: { line: CartLine }) {
  const { merchandise } = line;
  const lineTotal =
    Number(merchandise.price.amount) * line.quantity;

  return (
    <li className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href={`/store/${merchandise.product.handle}`}
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900"
      >
        {merchandise.image ? (
          <Image
            src={merchandise.image.url}
            alt={merchandise.image.altText ?? merchandise.product.title}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <Link
            href={`/store/${merchandise.product.handle}`}
            className="font-medium text-zinc-900 hover:text-emerald-700 dark:text-zinc-50 dark:hover:text-emerald-400"
          >
            {merchandise.product.title}
          </Link>
          {merchandise.title !== "Default Title" ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {merchandise.title}
            </p>
          ) : null}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {formatPrice(
              merchandise.price.amount,
              merchandise.price.currencyCode,
            )}{" "}
            each
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form action={updateCartLineAction} className="flex items-center gap-2">
            <input type="hidden" name="lineId" value={line.id} />
            <label className="sr-only" htmlFor={`qty-${line.id}`}>
              Quantity
            </label>
            <input
              id={`qty-${line.id}`}
              type="number"
              name="quantity"
              min={1}
              defaultValue={line.quantity}
              className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Update
            </button>
          </form>

          <form action={removeCartLineAction}>
            <input type="hidden" name="lineId" value={line.id} />
            <button
              type="submit"
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Remove
            </button>
          </form>
        </div>

        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Line total:{" "}
          {formatPrice(
            String(lineTotal),
            merchandise.price.currencyCode,
          )}
        </p>
      </div>
    </li>
  );
}
