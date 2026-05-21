import { Suspense } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import { StoreFilters } from "@/components/store/store-filters";
import { getStoreSession } from "@/lib/auth/session";
import {
  buildFilterFacets,
  filterStoreProducts,
  hasActiveFilters,
  parseActiveFilters,
} from "@/lib/shopify/filters";
import { getStoreListingMembershipPrices } from "@/lib/shopify/member-pricing";
import { getStoreProducts } from "@/lib/shopify/products";

export const metadata = {
  title: "Store | MLPA Health",
  description: "Browse products from the MLPA Health Shopify storefront",
};

type StorePageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function FiltersSkeleton() {
  return (
    <aside className="w-full shrink-0 lg:w-56 xl:w-64">
      <div className="h-80 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </aside>
  );
}

export default async function StorePage({ searchParams }: StorePageProps) {
  const params = await searchParams;
  const active = parseActiveFilters(params);
  const session = await getStoreSession();

  let allProducts: Awaited<ReturnType<typeof getStoreProducts>>["products"] = [];
  let error: string | null = null;

  try {
    const data = await getStoreProducts({ first: 50 });
    allProducts = data.products;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load products";
  }

  const products = filterStoreProducts(allProducts, active);
  const memberPrices =
    session?.isMembershipActive && products.length > 0
      ? await getStoreListingMembershipPrices(products)
      : new Map();
  const eligibleDiscountCount = [...memberPrices.values()].filter(
    (price) => price.hasDiscount,
  ).length;
  const facets = buildFilterFacets(allProducts, active);
  const filtersActive = hasActiveFilters(active);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <Suspense fallback={<FiltersSkeleton />}>
          <StoreFilters facets={facets} active={active} />
        </Suspense>

        <div className="min-w-0 flex-1">
          {session?.isMembershipActive ? (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <p className="font-medium">Member pricing is active</p>
              <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                Eligible products show your discounted member price. Products
                marked &quot;Not eligible&quot; stay at the regular price.
                {eligibleDiscountCount > 0
                  ? ` ${eligibleDiscountCount} product${eligibleDiscountCount === 1 ? "" : "s"} currently eligible.`
                  : null}
              </p>
            </div>
          ) : session ? (
            <div className="mb-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <p className="font-medium">Signed in · membership inactive</p>
              <p className="mt-1">
                You can browse and checkout at regular prices. Member discounts
                apply only when your membership is active.
              </p>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <Link
                href="/store/login"
                className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              >
                Sign in
              </Link>{" "}
              to browse with your account. Active members see discounted prices
              on eligible products.
            </div>
          )}

          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            {filtersActive ? "Filtered results" : "All products"}
            {products.length > 0 ? ` · ${products.length} products` : null}
          </p>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              <p className="font-medium">Could not load the storefront</p>
              <p className="mt-2 text-sm">{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                No products match these filters
              </p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Try removing a filter or browse all products.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  memberPrice={memberPrices.get(product.id)}
                  isMember={session?.isMembershipActive}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
