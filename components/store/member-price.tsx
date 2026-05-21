import { formatPrice } from "@/lib/shopify/products";
import type { VariantMembershipPrice } from "@/lib/shopify/member-pricing";

export function MemberPriceBadge({
  eligible,
}: {
  eligible: boolean;
}) {
  if (eligible) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        Member discount
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
      Not eligible
    </span>
  );
}

export function MemberPrice({
  price,
  className = "",
  showEligibility = false,
}: {
  price: VariantMembershipPrice;
  className?: string;
  showEligibility?: boolean;
}) {
  if (!price.hasDiscount) {
    return (
      <div className={className}>
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">
          {formatPrice(price.retailAmount, price.currencyCode)}
        </p>
        {showEligibility ? (
          <div className="mt-2">
            <MemberPriceBadge eligible={false} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-base font-medium text-emerald-700 dark:text-emerald-400">
        {formatPrice(price.memberAmount, price.currencyCode)}
        <span className="ml-2 text-sm font-normal text-zinc-500 line-through dark:text-zinc-400">
          {formatPrice(price.retailAmount, price.currencyCode)}
        </span>
      </p>
      {showEligibility ? (
        <div className="mt-2">
          <MemberPriceBadge eligible />
        </div>
      ) : (
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Member price
        </p>
      )}
    </div>
  );
}
