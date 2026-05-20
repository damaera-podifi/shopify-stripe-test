import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/store/add-to-cart-form";
import {
  formatPrice,
  getProductByHandle,
  productTypeToFilterParam,
} from "@/lib/shopify/products";

type ProductPageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: ProductPageProps) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    return { title: "Product not found | MLPA Health" };
  }

  return {
    title: `${product.title} | MLPA Health`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    notFound();
  }

  const { amount, currencyCode } = product.priceRange.minVariantPrice;
  const galleryImages =
    product.images.length > 0
      ? product.images
      : product.featuredImage
        ? [product.featuredImage]
        : [];

  const typeFilterHref = product.productType
    ? `/store?type=${productTypeToFilterParam(product.productType)}`
    : "/store";

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="mb-6 text-sm text-zinc-500">
        <Link href="/store" className="hover:text-emerald-700 dark:hover:text-emerald-400">
          ← All products
        </Link>
      </p>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
              {galleryImages[0] ? (
                <Image
                  src={galleryImages[0].url}
                  alt={galleryImages[0].altText ?? product.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  No image
                </div>
              )}
            </div>
            {galleryImages.length > 1 ? (
              <div className="grid grid-cols-4 gap-3">
                {galleryImages.slice(1, 5).map((image) => (
                  <div
                    key={image.url}
                    className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
                  >
                    <Image
                      src={image.url}
                      alt={image.altText ?? product.title}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              {product.productType ? (
                <Link
                  href={typeFilterHref}
                  className="inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-emerald-950 dark:hover:text-emerald-300"
                >
                  {product.productType}
                </Link>
              ) : null}
              <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {product.title}
              </p>
              <p className="text-2xl font-medium text-emerald-700 dark:text-emerald-400">
                {formatPrice(amount, currencyCode)}
              </p>
              {product.vendor ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {product.vendor}
                </p>
              ) : null}
            </div>

            {product.descriptionHtml ? (
              <div
                className="prose prose-zinc max-w-none text-sm leading-7 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
            ) : product.description ? (
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                {product.description}
              </p>
            ) : null}

            {product.variants.length > 1 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Variants
                </h2>
                <ul className="space-y-2">
                  {product.variants.map((variant) => (
                    <li
                      key={variant.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-zinc-800 dark:text-zinc-200">
                        {variant.title}
                      </span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {formatPrice(
                          variant.price.amount,
                          variant.price.currencyCode,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <AddToCartForm variants={product.variants} />
            </div>

            {product.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.tags.slice(0, 8).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
    </main>
  );
}
