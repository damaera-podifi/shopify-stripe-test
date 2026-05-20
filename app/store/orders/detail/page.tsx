import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderSummary } from "@/components/store/order-summary";
import { getShopifyOrderDetailsForEmail } from "@/lib/checkout/order-details";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export const metadata = {
  title: "Order details | MLPA Health",
  description: "View order status and items",
};

type OrderDetailPageProps = {
  searchParams: Promise<{ email?: string; id?: string }>;
};

export default async function OrderDetailPage({
  searchParams,
}: OrderDetailPageProps) {
  const params = await searchParams;
  const email = params.email?.trim() ?? "";
  const orderId = params.id?.trim() ?? "";

  if (!email || !orderId) {
    redirect("/store/orders");
  }

  let order = null;
  let error: string | null = null;

  try {
    logCheckout("order_detail_start", { email, orderId });
    order = await getShopifyOrderDetailsForEmail(orderId, email);
    if (!order) {
      error = "Order not found for this email.";
    } else {
      logCheckout("order_detail_ok", {
        email,
        shopifyOrderName: order.name,
      });
    }
  } catch (e) {
    logCheckoutError("order_detail_failed", e, { email, orderId });
    error = e instanceof Error ? e.message : "Could not load this order";
  }

  const ordersHref = `/store/orders?email=${encodeURIComponent(email)}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Order details
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {email}
        </p>
      </div>

      {error ? (
        <p className="mt-8 text-center text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : order ? (
        <OrderSummary order={order} />
      ) : null}

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href={ordersHref}
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
