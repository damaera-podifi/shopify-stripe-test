"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/store/product-card";
import { ProductSearch } from "@/components/store/product-search";
import { StoreFilters } from "@/components/store/store-filters";
import {
  buildFilterFacets,
  filterStoreProducts,
  hasActiveFilters,
  type ActiveFilters,
} from "@/lib/shopify/filters";
import {
  filterProductsBySearch,
  type StoreProduct,
  type StoreProductsPageInfo,
} from "@/lib/shopify/products";
import type { VariantMembershipPrice } from "@/lib/shopify/member-pricing";

type StoreBrowseProps = {
  initialProducts: StoreProduct[];
  initialPageInfo: StoreProductsPageInfo;
  initialMemberPrices: Record<string, VariantMembershipPrice>;
  active: ActiveFilters;
  searchQuery?: string | null;
  isMember?: boolean;
};

function FiltersSkeleton() {
  return (
    <aside className="w-full shrink-0 lg:w-56 xl:w-64">
      <div className="h-80 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
    </aside>
  );
}

function mergeProducts(
  current: StoreProduct[],
  incoming: StoreProduct[],
): StoreProduct[] {
  const seen = new Set(current.map((product) => product.id));
  const next = [...current];

  for (const product of incoming) {
    if (seen.has(product.id)) {
      continue;
    }
    seen.add(product.id);
    next.push(product);
  }

  return next;
}

export function StoreBrowse({
  initialProducts,
  initialPageInfo,
  initialMemberPrices,
  active,
  searchQuery = null,
  isMember,
}: StoreBrowseProps) {
  const [products, setProducts] = useState(initialProducts);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [memberPrices, setMemberPrices] = useState(
    () => new Map(Object.entries(initialMemberPrices)),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const filteredProducts = useMemo(() => {
    const searched = filterProductsBySearch(products, searchQuery);
    return filterStoreProducts(searched, active);
  }, [products, active, searchQuery]);
  const facets = useMemo(() => {
    const searched = filterProductsBySearch(products, searchQuery);
    return buildFilterFacets(searched, active);
  }, [products, active, searchQuery]);
  const filtersActive = hasActiveFilters(active);
  const searchActive = Boolean(searchQuery);

  const resultsLabel = searchActive
    ? `Results for “${searchQuery}”`
    : filtersActive
      ? "Filtered results"
      : "All products";

  const loadMore = useCallback(async () => {
    if (loading || !pageInfo.hasNextPage || !pageInfo.endCursor) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        cursor: pageInfo.endCursor,
      });
      if (searchQuery) {
        params.set("q", searchQuery);
      }
      const response = await fetch(`/api/store/products?${params.toString()}`);

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to load more products");
      }

      const data = (await response.json()) as {
        products: StoreProduct[];
        pageInfo: StoreProductsPageInfo;
        memberPrices: Record<string, VariantMembershipPrice>;
      };

      setProducts((current) => mergeProducts(current, data.products));
      setPageInfo(data.pageInfo);
      setMemberPrices((current) => {
        const next = new Map(current);
        for (const [productId, price] of Object.entries(data.memberPrices)) {
          next.set(productId, price);
        }
        return next;
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load more products",
      );
    } finally {
      setLoading(false);
    }
  }, [loading, pageInfo.endCursor, pageInfo.hasNextPage, searchQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !pageInfo.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, pageInfo.hasNextPage]);

  return (
    <div className="flex flex-col gap-8">
      <Suspense fallback={null}>
        <ProductSearch />
      </Suspense>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <Suspense fallback={<FiltersSkeleton />}>
          <StoreFilters facets={facets} active={active} />
        </Suspense>

        <div className="min-w-0 flex-1">
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          {resultsLabel}
          {filteredProducts.length > 0
            ? ` · ${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`
            : null}
          {pageInfo.hasNextPage ? " · scroll for more" : null}
        </p>

        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {searchActive
                ? pageInfo.hasNextPage
                  ? "No matches in loaded results yet"
                  : `No products found for “${searchQuery}”`
                : pageInfo.hasNextPage
                  ? "No matches in loaded products yet"
                  : "No products match these filters"}
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {searchActive
                ? pageInfo.hasNextPage
                  ? "Keep scrolling to load more matching products."
                  : "Try a different search term or clear filters."
                : pageInfo.hasNextPage
                  ? "Keep scrolling to load more products from the catalog."
                  : "Try removing a filter or browse all products."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                memberPrice={memberPrices.get(product.id)}
                isMember={isMember}
              />
            ))}
          </div>
        )}

        {pageInfo.hasNextPage ? (
          <div ref={sentinelRef} className="mt-8 flex justify-center py-4">
            {loading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading more products…
              </p>
            ) : error ? (
              <div className="text-center">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="mt-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Try again
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Scroll to load more
              </p>
            )}
          </div>
        ) : products.length > filteredProducts.length && filtersActive ? (
          <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            End of catalog for the current filters.
          </p>
        ) : null}
        </div>
      </div>
    </div>
  );
}
