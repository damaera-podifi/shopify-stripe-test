import { StoreHeader } from "@/components/store/store-header";
import { getTrackedSegmentIds } from "@/lib/auth/segments";
import { getSessionUser } from "@/lib/auth/session";
import { getAdminMemberPricing } from "@/lib/shopify/admin-member-pricing";
import { getBuyerContext } from "@/lib/shopify/buyer-context";
import { effectiveAdminMemberPricing } from "@/lib/shopify/member-pricing";
import { getCart } from "@/lib/shopify/cart";
import { getStoreProducts } from "@/lib/shopify/products";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const buyer = await getBuyerContext();
  const segmentPricing =
    user && getTrackedSegmentIds().length > 0
      ? await getAdminMemberPricing({
          email: user.email,
          shopifyCustomerId: user.shopifyCustomerId,
        }).catch(() => null)
      : null;
  const adminMemberPricing = effectiveAdminMemberPricing(user, segmentPricing);

  const [cart, shop] = await Promise.all([
    getCart(),
    getStoreProducts({
      first: 1,
      customerAccessToken: buyer?.customerAccessToken ?? null,
      adminMemberPricing,
    }),
  ]);

  const hasSegmentPricing =
    Boolean(user?.isMembership) ||
    Boolean(buyer?.customerAccessToken) ||
    Boolean(adminMemberPricing?.isMember);

  return (
    <div className="min-h-full bg-zinc-50 font-sans dark:bg-black">
      <StoreHeader
        shopName={shop.shopName}
        shopUrl={shop.shopUrl}
        cartCount={cart?.totalQuantity ?? 0}
        userEmail={user?.email ?? null}
        hasSegmentPricing={hasSegmentPricing}
        showPricingLink={Boolean(user && !buyer?.customerAccessToken)}
      />
      {children}
    </div>
  );
}
