"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  addToCartAction,
  type CartActionState,
} from "@/app/store/actions/cart";
import { useCartCount } from "@/components/store/cart-count-context";
import { formatPrice, type StoreProductVariant } from "@/lib/shopify/products";

type AddToCartFormProps = {
  variants: StoreProductVariant[];
};

export function AddToCartForm({ variants }: AddToCartFormProps) {
  const { addOptimistic, setCount } = useCartCount();
  const [message, setMessage] = useState<CartActionState>({});
  const [isPending, startTransition] = useTransition();

  const defaultVariant =
    variants.find((v) => v.availableForSale) ?? variants[0];
  const hasMultipleVariants =
    variants.length > 1 &&
    variants.some((v) => v.title !== "Default Title");

  if (!defaultVariant) {
    return (
      <p className="text-sm text-zinc-500">This product is unavailable.</p>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!defaultVariant.availableForSale || isPending) return;

    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get("quantity") ?? 1);

    addOptimistic(quantity);
    setMessage({ success: true });

    startTransition(async () => {
      const result = await addToCartAction({}, formData);

      if (result.error) {
        addOptimistic(-quantity);
        setMessage({ error: result.error });
        return;
      }

      if (result.totalQuantity !== undefined) {
        setCount(result.totalQuantity);
      }
      setMessage({ success: true });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasMultipleVariants ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Variant
          </span>
          <select
            name="merchandiseId"
            required
            defaultValue={defaultVariant.id}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            {variants.map((variant) => (
              <option
                key={variant.id}
                value={variant.id}
                disabled={!variant.availableForSale}
              >
                {variant.title}
                {!variant.availableForSale ? " (Unavailable)" : ""} —{" "}
                {formatPrice(
                  variant.price.amount,
                  variant.price.currencyCode,
                )}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="merchandiseId" value={defaultVariant.id} />
      )}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Quantity
        </span>
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={1}
          className="w-24 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </label>

      <button
        type="submit"
        disabled={!defaultVariant.availableForSale}
        className="w-full rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        Add to cart
      </button>

      {message.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{message.error}</p>
      ) : null}
      {message.success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Added to cart.{" "}
          <Link href="/store/cart" className="font-medium underline">
            View cart
          </Link>
        </p>
      ) : null}
    </form>
  );
}
