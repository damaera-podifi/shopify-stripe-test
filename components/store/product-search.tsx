"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  buildStoreQueryParams,
  parseActiveFilters,
} from "@/lib/shopify/filters";

export function ProductSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const [draft, setDraft] = useState(urlQuery);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const value = isFocused ? draft : urlQuery;

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const navigateWithQuery = (query: string) => {
    const active = parseActiveFilters(
      Object.fromEntries(searchParams.entries()),
    );
    const params = buildStoreQueryParams(active, {
      q: query.trim() || null,
    });
    const next = params.toString();
    const href = next ? `${pathname}?${next}` : pathname;
    router.push(href, { scroll: false });
  };

  const handleChange = (nextValue: string) => {
    setDraft(nextValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      navigateWithQuery(nextValue);
    }, 400);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    navigateWithQuery(value);
  };

  const handleClear = () => {
    setDraft("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    navigateWithQuery("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full" role="search">
      <label htmlFor="product-search" className="sr-only">
        Search products
      </label>
      <input
        id="product-search"
        type="search"
        value={value}
        onFocus={() => {
          setDraft(urlQuery);
          setIsFocused(true);
        }}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Search by name, variant, brand, or tag…"
        autoComplete="off"
        className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pr-24 pl-4 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-600"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            Clear
          </button>
        ) : null}
        <button
          type="submit"
          className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Search
        </button>
      </div>
    </form>
  );
}
