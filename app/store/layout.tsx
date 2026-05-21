import { StoreHeader } from "@/components/store/store-header";
import { getStoreSession } from "@/lib/auth/session";
import { getCartQuantity } from "@/lib/shopify/cart";
import { getStoreProducts } from "@/lib/shopify/products";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cartCount, shop, session] = await Promise.all([
    getCartQuantity(),
    getStoreProducts({ first: 1 }),
    getStoreSession(),
  ]);

  return (
    <div className="min-h-full bg-zinc-50 font-sans dark:bg-black">
      <StoreHeader
        shopName={shop.shopName}
        shopUrl={shop.shopUrl}
        cartCount={cartCount}
        session={session}
      />
      {children}
    </div>
  );
}
