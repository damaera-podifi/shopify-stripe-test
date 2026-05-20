import Link from "next/link";
import { OrderEmailForm } from "@/components/store/order-email-form";
import { OrderList } from "@/components/store/order-list";
import { listShopifyOrdersByEmail } from "@/lib/checkout/order-details";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export const metadata = {
  title: "My orders | MLPA Health",
  description: "View your order history",
};

type OrdersPageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const email = params.email?.trim() ?? "";
  const hasEmail = email.length > 0;

  let orders = null;
  let error: string | null = null;

  if (hasEmail) {
    try {
      logCheckout("orders_list_start", { email });
      orders = await listShopifyOrdersByEmail(email);
      logCheckout("orders_list_ok", { email, count: orders.length });
    } catch (e) {
      logCheckoutError("orders_list_failed", e, { email });
      error = e instanceof Error ? e.message : "Could not load your orders";
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          My orders
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Look up orders with the email you used at checkout.
        </p>
      </div>

      <div className="mt-8">
        <OrderEmailForm defaultEmail={email} />
      </div>

      {error ? (
        <p className="mt-8 text-center text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : null}

      {hasEmail && orders && !error ? (
        <OrderList email={email} orders={orders} />
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
