import Link from "next/link";
import { redirect } from "next/navigation";
import { fulfillStripePayment } from "@/lib/checkout/fulfillment";

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

  let orderName = params.order?.trim() || null;
  let error: string | null = null;

  try {
    const result = await fulfillStripePayment(paymentIntentId);
    orderName = result.shopifyOrderName ?? orderName;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not confirm your order";
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
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
            {orderName
              ? `Order ${orderName} has been created in Shopify.`
              : "Your order has been created in Shopify."}
          </p>
        </>
      )}
      <Link
        href="/store"
        className="mt-8 inline-block rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
      >
        Continue shopping
      </Link>
    </main>
  );
}
