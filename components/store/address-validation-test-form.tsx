"use client";

import { useState } from "react";
import type { CheckoutShippingInput } from "@/lib/checkout/types";
import type { AddressValidationMethodResult } from "@/lib/checkout/address-validation-methods";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

const emptyShipping: CheckoutShippingInput = {
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  address1: "131 Greene Street",
  address2: "",
  city: "New York",
  province: "NY",
  zip: "10012",
  country: "US",
};

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

function ResultCard({ result }: { result: AddressValidationMethodResult }) {
  return (
    <article className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{result.label}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            result.ok
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {result.ok ? "OK" : "Failed"}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {result.requiresCart ? "needs cart" : "no cart"}
        </span>
      </div>

      {result.errors.length ? (
        <ul className="mt-3 space-y-1 text-sm text-red-600 dark:text-red-400">
          {result.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {result.warnings.length ? (
        <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-300">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {Object.keys(result.details).length ? (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          {JSON.stringify(result.details, null, 2)}
        </pre>
      ) : null}
    </article>
  );
}

export function AddressValidationTestForm() {
  const [shipping, setShipping] = useState<CheckoutShippingInput>(emptyShipping);
  const [includeCartMethod, setIncludeCartMethod] = useState(true);
  const [results, setResults] = useState<AddressValidationMethodResult[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResults(null);

    const res = await fetch("/api/dev/address-validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...shipping, includeCartMethod }),
    });

    const data = (await res.json()) as {
      results?: AddressValidationMethodResult[];
      error?: string;
    };

    setPending(false);

    if (!res.ok || !data.results) {
      setError(data.error ?? "Validation test failed");
      return;
    }

    setResults(data.results);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <ShippingFields shipping={shipping} onChange={setShipping} />

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={includeCartMethod}
            onChange={(e) => setIncludeCartMethod(e.target.checked)}
          />
          Also run Storefront cart STRICT (requires items in cart cookie)
        </label>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600"
        >
          {pending ? "Running checks…" : "Run validation comparison"}
        </button>
      </form>

      {results ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Results
          </h2>
          {results.map((result) => (
            <ResultCard key={result.method} result={result} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
