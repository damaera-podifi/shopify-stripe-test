import Image from "next/image";
import Link from "next/link";
import type { CartLine } from "@/lib/shopify/cart";
import { formatPrice } from "@/lib/shopify/format-price";

export function CheckoutLineItem({ line }: { line: CartLine }) {
  const { merchandise } = line;
  const lineTotal = Number(merchandise.price.amount) * line.quantity;

  return (
    <li className="flex gap-4 border-b border-zinc-200 py-4 last:border-0 dark:border-zinc-800">
      <Link
        href={`/store/${merchandise.product.handle}`}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900"
      >
        {merchandise.image ? (
          <Image
            src={merchandise.image.url}
            alt={merchandise.image.altText ?? merchandise.product.title}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            No image
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
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
        <p className="mt-1 flex flex-wrap items-baseline gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Qty {line.quantity} ×{" "}
            {formatPrice(
              merchandise.price.amount,
              merchandise.price.currencyCode,
            )}
          </span>
          {merchandise.compareAtPrice &&
          Number(merchandise.compareAtPrice.amount) >
            Number(merchandise.price.amount) ? (
            <span className="text-zinc-500 line-through dark:text-zinc-500">
              {formatPrice(
                merchandise.compareAtPrice.amount,
                merchandise.compareAtPrice.currencyCode,
              )}
            </span>
          ) : null}
        </p>
        {!merchandise.availableForSale ? (
          <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
            No longer available
          </p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {formatPrice(
            String(lineTotal),
            merchandise.price.currencyCode,
          )}
        </p>
      </div>
    </li>
  );
}
