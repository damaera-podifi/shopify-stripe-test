"use client";

import Link from "next/link";
import { useCartCount } from "@/components/store/cart-count-context";
import { StoreAuthControls } from "@/components/store/store-auth-controls";
import type { StoreSession } from "@/lib/auth/session";

type StoreHeaderProps = {
  shopName: string;
  shopUrl: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
  session?: StoreSession | null;
};

export function StoreHeader({
  shopName,
  shopUrl,
  title,
  backHref = "/store",
  backLabel = "All products",
  session = null,
}: StoreHeaderProps) {
  const { count: cartCount } = useCartCount();
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
          <StoreAuthControls session={session} />
          <Link
            href="/store/orders"
            className="rounded-full border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            My orders
          </Link>
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
