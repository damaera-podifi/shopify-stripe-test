import Link from "next/link";
import { redirect } from "next/navigation";
import { CartCountReset } from "@/components/store/cart-count-context";
import { OrderSummary } from "@/components/store/order-summary";
import { getOrderDetailsByPaymentIntent } from "@/lib/checkout/order-details";
import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";

export const metadata = {
  title: "Order confirmed | MLPA Health",
  description: "Your order was placed successfully",
};

type SuccessPageProps = {
  searchParams: Promise<{ payment_intent?: string; order?: string }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams;
  const paymentIntentId = params.payment_intent?.trim();

  if (!paymentIntentId) {
    redirect("/store");
  }

  let order = null;
  let error: string | null = null;

  try {
    logCheckout("success_page_fulfillment_start", { paymentIntentId });
    order = await getOrderDetailsByPaymentIntent(paymentIntentId);
    if (!order) {
      error = "Order was paid but could not be loaded from Shopify.";
    } else {
      logCheckout("success_page_fulfillment_ok", {
        paymentIntentId,
        shopifyOrderName: order.name,
      });
    }
  } catch (e) {
    logCheckoutError("success_page_fulfillment_failed", e, { paymentIntentId });
    error = e instanceof Error ? e.message : "Could not confirm your order";
  }

  const trackHref = `/store/orders/track?payment_intent=${encodeURIComponent(paymentIntentId)}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <CartCountReset />
      <div className="text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Payment received
            </h1>
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
              {error}. If you were charged, contact support with reference{" "}
              <span className="font-mono">{paymentIntentId}</span>.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Thank you for your order
            </h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {order
                ? `Order ${order.name} has been created.`
                : "Your order has been created in Shopify."}
            </p>
          </>
        )}
      </div>

      {order ? <OrderSummary order={order} /> : null}

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href={trackHref}
          className="inline-block rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          Refresh order status
        </Link>
        <Link
          href="/store"
          className="inline-block rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
        >
          Continue shopping
        </Link>
      </div>

      {!error ? (
        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Bookmark this page or save{" "}
          <Link href={trackHref} className="underline hover:text-zinc-700 dark:hover:text-zinc-200">
            your order status link
          </Link>{" "}
          to check fulfillment later without logging in.
        </p>
      ) : null}
    </main>
  );
}
