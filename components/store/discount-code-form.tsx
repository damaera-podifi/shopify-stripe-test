"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Cart } from "@/lib/shopify/cart";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

type DiscountCodeFormProps = {
  discountCodes: Cart["discountCodes"];
  onCartUpdated?: (cart: Cart) => void;
  compact?: boolean;
};

export function DiscountCodeForm({
  discountCodes,
  onCartUpdated,
  compact = false,
}: DiscountCodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeCodes = discountCodes
    .filter((entry) => entry.applicable)
    .map((entry) => entry.code);
  const inactiveCodes = discountCodes.filter((entry) => !entry.applicable);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/cart/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = (await res.json()) as {
      cart?: Cart;
      applied?: boolean;
      message?: string;
      error?: string;
    };

    setPending(false);

    if (!res.ok || !data.cart) {
      setError(data.error ?? "Could not apply discount code");
      return;
    }

    onCartUpdated?.(data.cart);
    router.refresh();

    if (data.applied) {
      setCode("");
      setMessage(data.message ?? "Discount applied.");
    } else {
      setError(data.message ?? "This discount code is not valid for your cart.");
    }
  }

  async function handleRemove() {
    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/cart/discount", { method: "DELETE" });
    const data = (await res.json()) as {
      cart?: Cart;
      message?: string;
      error?: string;
    };

    setPending(false);

    if (!res.ok || !data.cart) {
      setError(data.error ?? "Could not remove discount code");
      return;
    }

    onCartUpdated?.(data.cart);
    router.refresh();
    setMessage(data.message ?? "Discount removed.");
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? (
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Discount code
        </h3>
      ) : null}

      {activeCodes.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>
            Code applied:{" "}
            <span className="font-medium">{activeCodes.join(", ")}</span>
          </span>
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="font-medium text-emerald-900 underline hover:no-underline disabled:opacity-50 dark:text-emerald-200"
          >
            Remove
          </button>
        </div>
      ) : null}

      {inactiveCodes.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start justify-between gap-3">
            <p>
              <span className="font-medium">{inactiveCodes[0].code}</span> is on
              this cart but not giving a discount. Check that your items qualify
              for this code.
            </p>
            <button
              type="button"
              onClick={handleRemove}
              disabled={pending}
              className="shrink-0 font-medium underline hover:no-underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      {activeCodes.length === 0 ? (
        <form onSubmit={handleApply} className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            disabled={pending}
            className={inputClassName}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="shrink-0 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
    </div>
  );
}
