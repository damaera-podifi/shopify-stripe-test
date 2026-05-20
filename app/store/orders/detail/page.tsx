import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderActionsPanel } from "@/components/store/order-actions-panel";
import { OrderSummary } from "@/components/store/order-summary";
import { getStoreSession } from "@/lib/auth/session";
import { getShopifyOrderDetailsForUser } from "@/lib/checkout/order-details";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export const metadata = {
  title: "Order details | MLPA Health",
  description: "View order status and items",
};

type OrderDetailPageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function OrderDetailPage({
  searchParams,
}: OrderDetailPageProps) {
  const session = await getStoreSession();
  if (!session) {
    redirect("/store/login?redirect=/store/orders");
  }

  const params = await searchParams;
  const orderId = params.id?.trim() ?? "";

  if (!orderId) {
    redirect("/store/orders");
  }

  let order = null;
  let error: string | null = null;

  try {
    logCheckout("order_detail_start", {
      userId: session.userId,
      orderId,
    });
    order = await getShopifyOrderDetailsForUser(
      orderId,
      session.userId,
      session.email,
    );
    if (!order) {
      error = "Order not found for your account.";
    } else {
      logCheckout("order_detail_ok", {
        userId: session.userId,
        shopifyOrderName: order.name,
      });
    }
  } catch (e) {
    logCheckoutError("order_detail_failed", e, {
      userId: session.userId,
      orderId,
    });
    error = e instanceof Error ? e.message : "Could not load this order";
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Order details
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Account: {session.email}
          {order?.email && order.email !== session.email ? (
            <>
              {" "}
              · Order contact: {order.email}
            </>
          ) : null}
        </p>
      </div>

      {error ? (
        <p className="mt-8 text-center text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : order ? (
        <>
          <OrderSummary order={order} />
          <OrderActionsPanel order={order} />
        </>
      ) : null}

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/store/orders"
          className="inline-block rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Back to my orders
        </Link>
        <Link
          href="/store"
          className="inline-block rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
        >
          Continue shopping
        </Link>
      </div>
    </main>
  );
}
