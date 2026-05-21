type MemberPricingBannerProps = {
  email: string;
  hasMemberPricing: boolean;
  adminConfigured: boolean;
};

export function MemberPricingBanner({
  email,
  hasMemberPricing,
  adminConfigured,
}: MemberPricingBannerProps) {
  if (hasMemberPricing) return null;

  if (!adminConfigured) {
    return (
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">Member pricing not configured</p>
        <p className="mt-1">
          Add these to <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.local</code>{" "}
          (segment GID from Shopify Admin → Customers → Segments → open segment → copy ID from URL):
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-amber-100/80 p-2 text-xs dark:bg-amber-900/60">{`SHOPIFY_SEGMENT_IDS=gid://shopify/Segment/YOUR_SEGMENT_ID
SHOPIFY_MEMBER_DISCOUNT_PERCENT=10`}</pre>
        <p className="mt-2">
          Signed in as <strong>{email}</strong>. Admin API will check segment membership automatically on each visit.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      <p>
        Signed in as <strong>{email}</strong>. Segment membership was checked via Admin API — no
        matching segment for the IDs in <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">SHOPIFY_SEGMENT_IDS</code>.
      </p>
    </div>
  );
}
