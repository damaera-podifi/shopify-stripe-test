import Link from "next/link";
import { StoreBrowse } from "@/components/store/store-browse";
import { getStoreSession } from "@/lib/auth/session";
import {
  parseActiveFilters,
} from "@/lib/shopify/filters";
import { getStoreListingMembershipPrices } from "@/lib/shopify/member-pricing";
import {
  getStoreProducts,
  STORE_PRODUCTS_PAGE_SIZE,
} from "@/lib/shopify/products";

export const metadata = {
  title: "Store | MLPA Health",
  description: "Browse products from the MLPA Health Shopify storefront",
};

type StorePageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function activeFiltersKey(active: ReturnType<typeof parseActiveFilters>) {
  return JSON.stringify(active);
}

export default async function StorePage({ searchParams }: StorePageProps) {
  const params = await searchParams;
  const active = parseActiveFilters(params);
  const session = await getStoreSession();

  let initialProducts: Awaited<ReturnType<typeof getStoreProducts>>["products"] =
    [];
  let pageInfo: Awaited<ReturnType<typeof getStoreProducts>>["pageInfo"] = {
    hasNextPage: false,
    endCursor: null,
  };
  let error: string | null = null;

  try {
    const data = await getStoreProducts({ first: STORE_PRODUCTS_PAGE_SIZE });
    initialProducts = data.products;
    pageInfo = data.pageInfo;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load products";
  }

  const memberPrices =
    session?.isMembershipActive && initialProducts.length > 0
      ? await getStoreListingMembershipPrices(initialProducts)
      : new Map();
  const eligibleDiscountCount = [...memberPrices.values()].filter(
    (price) => price.hasDiscount,
  ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        {session?.isMembershipActive ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
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
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <p className="font-medium">Signed in · membership inactive</p>
            <p className="mt-1">
              You can browse and checkout at regular prices. Member discounts
              apply only when your membership is active.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
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
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">Could not load the storefront</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : (
        <StoreBrowse
          key={activeFiltersKey(active)}
          initialProducts={initialProducts}
          initialPageInfo={pageInfo}
          initialMemberPrices={Object.fromEntries(memberPrices)}
          active={active}
          isMember={session?.isMembershipActive}
        />
      )}
    </main>
  );
}
