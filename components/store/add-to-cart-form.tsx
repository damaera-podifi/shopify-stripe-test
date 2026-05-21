"use client";

import { useActionState } from "react";
import {
  addToCartAction,
  type CartActionState,
} from "@/app/store/actions/cart";
import { formatPrice } from "@/lib/shopify/format-price";
import type { StoreProductVariant } from "@/lib/shopify/products";

const initialState: CartActionState = {};

type AddToCartFormProps = {
  variants: StoreProductVariant[];
};

export function AddToCartForm({ variants }: AddToCartFormProps) {
  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
  );

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

  return (
    <form action={formAction} className="space-y-4">
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
        disabled={pending || !defaultVariant.availableForSale}
        className="w-full rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        {pending ? "Adding…" : "Add to cart"}
      </button>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Added to cart.{" "}
          <a href="/store/cart" className="font-medium underline">
            View cart
          </a>
        </p>
      ) : null}
    </form>
  );
}
