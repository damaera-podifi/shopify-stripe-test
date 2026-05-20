"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CheckoutShippingInput } from "@/lib/checkout/types";
import { formatPrice } from "@/lib/shopify/products";

type CheckoutFormProps = {
  publishableKey: string;
  currencyCode: string;
  totalAmount: string;
  totalQuantity: number;
  disabled?: boolean;
};

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function ShippingFields({
  shipping,
  onChange,
}: {
  shipping: CheckoutShippingInput;
  onChange: (next: CheckoutShippingInput) => void;
}) {
  const set =
    (key: keyof CheckoutShippingInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange({ ...shipping, [key]: e.target.value });
    };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          value={shipping.email}
          onChange={set("email")}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">First name</label>
        <input
          required
          value={shipping.firstName}
          onChange={set("firstName")}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Last name</label>
        <input
          required
          value={shipping.lastName}
          onChange={set("lastName")}
          className={inputClassName}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium">Address</label>
        <input
          required
          value={shipping.address1}
          onChange={set("address1")}
          className={inputClassName}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium">
          Apartment, suite, etc. (optional)
        </label>
        <input
          value={shipping.address2 ?? ""}
          onChange={set("address2")}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">City</label>
        <input
          required
          value={shipping.city}
          onChange={set("city")}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">State / Province</label>
        <input
          required
          value={shipping.province}
          onChange={set("province")}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">ZIP / Postal code</label>
        <input
          required
          value={shipping.zip}
          onChange={set("zip")}
          className={inputClassName}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Country</label>
        <select
          required
          value={shipping.country}
          onChange={set("country")}
          className={inputClassName}
        >
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
      </div>
    </div>
  );
}

function PaymentStep({
  shipping,
  totalAmount,
  currencyCode,
  totalQuantity,
  onBack,
}: {
  shipping: CheckoutShippingInput;
  totalAmount: string;
  currencyCode: string;
  totalQuantity: number;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPending(true);
    setError(null);

    const returnUrl = `${window.location.origin}/store/checkout/success`;

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
        receipt_email: shipping.email,
        shipping: {
          name: `${shipping.firstName} ${shipping.lastName}`,
          address: {
            line1: shipping.address1,
            line2: shipping.address2 || undefined,
            city: shipping.city,
            state: shipping.province,
            postal_code: shipping.zip,
            country: shipping.country,
          },
        },
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setPending(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      const completeRes = await fetch("/api/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });
      const completeData = (await completeRes.json()) as {
        error?: string;
        shopifyOrderName?: string;
      };

      if (!completeRes.ok) {
        setError(completeData.error ?? "Order fulfillment failed");
        setPending(false);
        return;
      }

      const orderQuery = completeData.shopifyOrderName
        ? `&order=${encodeURIComponent(completeData.shopifyOrderName)}`
        : "";
      router.push(
        `/store/checkout/success?payment_intent=${paymentIntent.id}${orderQuery}`,
      );
      return;
    }

    setPending(false);
  }

  return (
    <form onSubmit={handlePay} className="space-y-6">
      <PaymentElement />
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="flex flex-1 items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || pending}
          className="flex flex-1 items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600"
        >
          {pending
            ? "Processing…"
            : `Pay ${formatPrice(totalAmount, currencyCode)}`}
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Paying for {totalQuantity} item{totalQuantity === 1 ? "" : "s"}. Taxes
        and shipping may be reflected in Shopify order records.
      </p>
    </form>
  );
}

export function CheckoutForm({
  publishableKey,
  currencyCode,
  totalAmount,
  totalQuantity,
  disabled = false,
}: CheckoutFormProps) {
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  );

  const [shipping, setShipping] = useState<CheckoutShippingInput>({
    email: "",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    zip: "",
    country: "US",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;

    setLoadingIntent(true);
    setError(null);

    const res = await fetch("/api/checkout/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shipping),
    });
    const data = (await res.json()) as {
      clientSecret?: string;
      error?: string;
    };

    setLoadingIntent(false);

    if (!res.ok || !data.clientSecret) {
      setError(data.error ?? "Could not start checkout");
      return;
    }

    setClientSecret(data.clientSecret);
  }

  if (!clientSecret) {
    return (
      <form onSubmit={handleContinue} className="space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Shipping
        </h2>
        <ShippingFields shipping={shipping} onChange={setShipping} />
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={disabled || loadingIntent}
          className="flex w-full items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600"
        >
          {loadingIntent ? "Loading…" : "Continue to payment"}
        </button>
      </form>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Payment
      </h2>
      <PaymentStep
        shipping={shipping}
        totalAmount={totalAmount}
        currencyCode={currencyCode}
        totalQuantity={totalQuantity}
        onBack={() => setClientSecret(null)}
      />
    </Elements>
  );
}
