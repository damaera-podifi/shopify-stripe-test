import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderList } from "@/components/store/order-list";
import { getStoreSession } from "@/lib/auth/session";
import { listShopifyOrdersForUser } from "@/lib/checkout/order-details";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export const metadata = {
  title: "My orders | MLPA Health",
  description: "View your order history",
};

export default async function OrdersPage() {
  const session = await getStoreSession();
  if (!session) {
    redirect("/store/login?redirect=/store/orders");
  }

  let orders = null;
  let error: string | null = null;

  try {
    logCheckout("orders_list_start", {
      userId: session.userId,
      email: session.email,
    });
    orders = await listShopifyOrdersForUser(session.userId, session.email);
    logCheckout("orders_list_ok", {
      userId: session.userId,
      count: orders.length,
    });
  } catch (e) {
    logCheckoutError("orders_list_failed", e, { userId: session.userId });
    error = e instanceof Error ? e.message : "Could not load your orders";
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          My orders
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {session.email}
          </span>
        </p>
      </div>

      {error ? (
        <p className="mt-8 text-center text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : null}

      {orders && !error ? (
        <OrderList accountEmail={session.email} orders={orders} />
      ) : null}

      <div className="mt-8 text-center">
        <Link
          href="/store"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Back to store
        </Link>
      </div>
    </main>
  );
}
