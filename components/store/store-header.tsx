import Link from "next/link";
import { LogoutButton } from "./logout-button";

type StoreHeaderProps = {
  shopName: string;
  shopUrl: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
  cartCount?: number;
  userEmail?: string | null;
  hasSegmentPricing?: boolean;
  showPricingLink?: boolean;
};

export function StoreHeader({
  shopName,
  shopUrl,
  title,
  backHref = "/store",
  backLabel = "All products",
  cartCount = 0,
  userEmail = null,
  hasSegmentPricing = false,
  showPricingLink = false,
}: StoreHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Shopify Storefront
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {title ?? shopName}
          </h1>
          {!title ? null : (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{shopName}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {userEmail ? (
            <span className="text-zinc-600 dark:text-zinc-400">
              {userEmail}
              {hasSegmentPricing ? (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Member pricing
                </span>
              ) : showPricingLink ? (
                <Link
                  href="/api/auth/shopify/start"
                  className="ml-2 text-xs font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                >
                  Exact Shopify pricing
                </Link>
              ) : null}
            </span>
          ) : (
            <Link
              href="/store/login"
              className="rounded-full border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/store/cart"
            className="relative rounded-full border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cart
            {cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-xs font-medium text-white dark:bg-emerald-600">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>
          {userEmail ? <LogoutButton /> : null}
          <Link
            href={backHref}
            className="rounded-full border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {backLabel}
          </Link>
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            View on Shopify
          </a>
        </div>
      </div>
    </header>
  );
}
