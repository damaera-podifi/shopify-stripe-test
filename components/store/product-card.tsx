import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/store/add-to-cart-button";
import { formatPrice } from "@/lib/shopify/format-price";
import type { StoreProduct } from "@/lib/shopify/products";

export function ProductCard({ product }: { product: StoreProduct }) {
  const { amount, currencyCode } = product.priceRange.minVariantPrice;
  const compareAt = product.compareAtPriceRange?.minVariantPrice;
  const image = product.featuredImage;
  const defaultVariant = product.variants[0];

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href={`/store/${product.handle}`}
        className="group block"
      >
        <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
          {image ? (
            <Image
              src={image.url}
              alt={image.altText ?? product.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">
              No image
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {product.productType ? (
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {product.productType}
          </p>
        ) : null}
        <Link href={`/store/${product.handle}`}>
          <h2 className="text-lg font-semibold text-zinc-900 hover:text-emerald-700 dark:text-zinc-50 dark:hover:text-emerald-400">
            {product.title}
          </h2>
        </Link>
        {product.description ? (
          <p className="line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {product.description}
          </p>
        ) : null}
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-base font-medium text-emerald-700 dark:text-emerald-400">
            {formatPrice(amount, currencyCode)}
          </p>
          {compareAt &&
          Number(compareAt.amount) > Number(amount) ? (
            <p className="text-sm text-zinc-500 line-through dark:text-zinc-400">
              {formatPrice(compareAt.amount, compareAt.currencyCode)}
            </p>
          ) : null}
        </div>
        {defaultVariant ? (
          <AddToCartButton
            merchandiseId={defaultVariant.id}
            availableForSale={defaultVariant.availableForSale}
            className="mt-auto pt-2"
          />
        ) : (
          <Link
            href={`/store/${product.handle}`}
            className="mt-auto block rounded-full border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            View product
          </Link>
        )}
      </div>
    </article>
  );
}
