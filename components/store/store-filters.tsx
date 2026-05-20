"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  buildStoreSearchParams,
  type ActiveFilters,
  type FilterFacetGroup,
  type FilterGroupId,
} from "@/lib/shopify/filters";

type StoreFiltersProps = {
  facets: FilterFacetGroup[];
  active: ActiveFilters;
};

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 shrink-0 text-zinc-400"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      {expanded ? (
        <path
          fillRule="evenodd"
          d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      )}
    </svg>
  );
}

function FilterSection({
  facet,
  activeValues,
  expanded,
  onToggleExpand,
  buildHref,
}: {
  facet: FilterFacetGroup;
  activeValues: string[];
  expanded: boolean;
  onToggleExpand: () => void;
  buildHref: (groupId: FilterGroupId, value: string) => string;
}) {
  return (
    <section className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between py-4 text-left"
        aria-expanded={expanded}
      >
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {facet.label}
        </span>
        <Chevron expanded={expanded} />
      </button>

      {expanded ? (
        <ul className="space-y-0.5 pb-4">
          {facet.options.map((option) => {
            const isActive = activeValues.includes(option.value);
            const isDisabled = option.count === 0;
            const href = buildHref(facet.id, option.value);

            return (
              <li key={option.value}>
                <Link
                  href={href}
                  scroll={false}
                  aria-disabled={isDisabled}
                  className={
                    isDisabled
                      ? "pointer-events-none flex items-center gap-3 rounded-md px-1 py-2.5 text-zinc-300 dark:text-zinc-600"
                      : isActive
                        ? "flex items-center gap-3 rounded-md bg-emerald-50 px-1 py-2.5 dark:bg-emerald-950/30"
                        : "flex items-center gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-emerald-50/70 dark:hover:bg-emerald-950/20"
                  }
                >
                  <span
                    className={
                      isDisabled
                        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700"
                        : isActive
                          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500"
                          : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-emerald-400/80"
                    }
                    aria-hidden
                  >
                    {isActive && !isDisabled ? (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    ) : null}
                  </span>
                  <span
                    className={
                      isDisabled
                        ? "flex-1 text-sm text-zinc-300 dark:text-zinc-600"
                        : "flex-1 text-sm text-zinc-600 dark:text-zinc-300"
                    }
                  >
                    {option.label}
                  </span>
                  <span
                    className={
                      isDisabled
                        ? "text-xs tabular-nums text-zinc-300 dark:text-zinc-600"
                        : "text-xs tabular-nums text-zinc-400 dark:text-zinc-500"
                    }
                  >
                    {option.count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function StoreFilters({ facets, active }: StoreFiltersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<Record<FilterGroupId, boolean>>({
    type: true,
    goal: false,
    age: false,
    gender: false,
    brand: false,
    diet: false,
  });

  const buildHref = (groupId: FilterGroupId, value: string) => {
    const params = buildStoreSearchParams(active, { groupId, value });
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const clearHref = pathname;
  const hasFilters = Object.values(active).some((values) => values.length > 0);

  return (
    <aside className="w-full shrink-0 lg:w-56 xl:w-64">
      <div className="sticky top-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-medium tracking-[0.2em] text-zinc-400 uppercase">
            Filters
          </p>
          {hasFilters ? (
            <Link
              href={clearHref}
              scroll={false}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
            >
              Clear
            </Link>
          ) : null}
        </div>

        <nav aria-label="Product filters" className="rounded-lg bg-white dark:bg-zinc-950">
          {facets.map((facet) => (
            <FilterSection
              key={facet.id}
              facet={facet}
              activeValues={active[facet.id]}
              expanded={expanded[facet.id]}
              onToggleExpand={() =>
                setExpanded((state) => ({
                  ...state,
                  [facet.id]: !state[facet.id],
                }))
              }
              buildHref={buildHref}
            />
          ))}
        </nav>

        {searchParams.toString() ? (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Select filters to narrow results. Multiple options in one group
            match any selected value.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
