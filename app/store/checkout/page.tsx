import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutPageClient } from "@/components/store/checkout-page-client";
import { getStoreSession } from "@/lib/auth/session";
import {
  findUserByEmail,
  userRecordToCheckoutShipping,
} from "@/lib/auth/users-db";
import { getStripePublishableKey } from "@/lib/stripe/config";
import { getCart } from "@/lib/shopify/cart";

export const metadata = {
  title: "Checkout | MLPA Health",
  description: "Complete your purchase",
};

export default async function CheckoutPage() {
  const [cart, session] = await Promise.all([getCart(), getStoreSession()]);
  const user = session ? await findUserByEmail(session.email) : null;
  const defaultShipping = user ? userRecordToCheckoutShipping(user) : null;

  if (!cart || cart.lines.length === 0) {
    redirect("/store/cart");
  }

  const hasUnavailableItems = cart.lines.some(
    (line) => !line.merchandise.availableForSale,
  );

  let publishableKey: string;
  try {
    publishableKey = getStripePublishableKey();
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
          Stripe is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and
          STRIPE_SECRET_KEY to your environment.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Checkout
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter shipping details and pay securely with Stripe. Your order is
          created in Shopify after payment succeeds.
          {session ? (
            <>
              {" "}
              Signed in as{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {session.email}
              </span>
              ; you can use a different contact email below.
            </>
          ) : null}
        </p>
      </div>

      <CheckoutPageClient
        initialCart={cart}
        publishableKey={publishableKey}
        defaultShipping={defaultShipping ?? undefined}
        hasUnavailableItems={hasUnavailableItems}
      />
    </main>
  );
}
