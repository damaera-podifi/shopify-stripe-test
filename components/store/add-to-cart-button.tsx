"use client";

import { useActionState } from "react";
import {
  addToCartAction,
  type CartActionState,
} from "@/app/store/actions/cart";

const initialState: CartActionState = {};

type AddToCartButtonProps = {
  merchandiseId: string;
  availableForSale?: boolean;
  className?: string;
};

export function AddToCartButton({
  merchandiseId,
  availableForSale = true,
  className = "",
}: AddToCartButtonProps) {
  const [state, formAction, pending] = useActionState(
    addToCartAction,
    initialState,
  );

  return (
    <div className={className}>
      <form action={formAction}>
        <input type="hidden" name="merchandiseId" value={merchandiseId} />
        <input type="hidden" name="quantity" value={1} />
        <button
          type="submit"
          disabled={pending || !availableForSale}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-full border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-600 dark:bg-zinc-950 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
        >
          {pending ? "Adding…" : "Add to cart"}
        </button>
      </form>
      {state.error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
          Added!
        </p>
      ) : null}
    </div>
  );
}
