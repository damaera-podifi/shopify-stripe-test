import { StoreShell } from "@/components/store/store-shell";
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
    <StoreShell
      initialCartCount={cartCount}
      shopName={shop.shopName}
      shopUrl={shop.shopUrl}
      session={session}
    >
      {children}
    </StoreShell>
  );
}
