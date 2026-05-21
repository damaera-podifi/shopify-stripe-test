import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderSummary } from "@/components/store/order-summary";
import { getOrderDetailsByPaymentIntent } from "@/lib/checkout/order-details";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export const metadata = {
  title: "Track order | MLPA Health",
  description: "View your order status and items",
};

type TrackOrderPageProps = {
  searchParams: Promise<{ payment_intent?: string }>;
};

export default async function TrackOrderPage({
  searchParams,
}: TrackOrderPageProps) {
  const params = await searchParams;
  const paymentIntentId = params.payment_intent?.trim();

  if (!paymentIntentId) {
    redirect("/store");
  }

  let order = null;
  let error: string | null = null;

  try {
    logCheckout("track_page_start", { paymentIntentId });
    order = await getOrderDetailsByPaymentIntent(paymentIntentId);
    if (!order) {
      error = "Order not found";
    } else {
      logCheckout("track_page_ok", {
        paymentIntentId,
        shopifyOrderName: order.name,
      });
    }
  } catch (e) {
    logCheckoutError("track_page_failed", e, { paymentIntentId });
    error = e instanceof Error ? e.message : "Could not load your order";
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Order status
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Reference{" "}
          <span className="font-mono text-zinc-800 dark:text-zinc-200">
            {paymentIntentId}
          </span>
        </p>
      </div>

      {error ? (
        <p className="mt-8 text-center text-sm text-amber-700 dark:text-amber-400">
          {error}
        </p>
      ) : order ? (
        <OrderSummary order={order} />
      ) : null}

      <div className="mt-8 text-center">
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
