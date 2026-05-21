import Image from "next/image";
import Link from "next/link";
import type { CartLine } from "@/lib/shopify/cart";
import { formatPrice } from "@/lib/shopify/products";

function lineDiscountTotal(line: CartLine): number {
  return line.discountAllocations.reduce(
    (sum, allocation) => sum + Number(allocation.discountedAmount.amount),
    0,
  );
}

export function CheckoutLineItem({ line }: { line: CartLine }) {
  const { merchandise } = line;
  const lineSubtotal = Number(line.cost.subtotalAmount.amount);
  const lineTotal = Number(line.cost.totalAmount.amount);
  const discountTotal = lineDiscountTotal(line);

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
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Qty {line.quantity} ×{" "}
          {formatPrice(
            merchandise.price.amount,
            merchandise.price.currencyCode,
          )}
        </p>
        {discountTotal > 0 ? (
          <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
            Membership discount applied
          </p>
        ) : null}
        {!merchandise.availableForSale ? (
          <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
            No longer available
          </p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {discountTotal > 0 ? (
            <span className="mr-2 text-zinc-400 line-through">
              {formatPrice(
                String(lineSubtotal),
                line.cost.subtotalAmount.currencyCode,
              )}
            </span>
          ) : null}
          {formatPrice(
            String(lineTotal),
            line.cost.totalAmount.currencyCode,
          )}
        </p>
      </div>
    </li>
  );
}
