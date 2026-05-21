import { StoreHeader } from "@/components/store/store-header";
import { userHasAnySegment } from "@/lib/auth/segments";
import { getSessionUser } from "@/lib/auth/session";
import { getCart } from "@/lib/shopify/cart";
import { getStoreProducts } from "@/lib/shopify/products";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cart, shop, user] = await Promise.all([
    getCart(),
    getStoreProducts({ first: 1 }),
    getSessionUser(),
  ]);

  const hasSegmentPricing = user ? await userHasAnySegment(user) : false;

  return (
    <div className="min-h-full bg-zinc-50 font-sans dark:bg-black">
      <StoreHeader
        shopName={shop.shopName}
        shopUrl={shop.shopUrl}
        cartCount={cart?.totalQuantity ?? 0}
        userEmail={user?.email ?? null}
        hasSegmentPricing={hasSegmentPricing}
      />
      {children}
    </div>
  );
}
