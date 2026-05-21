"use client";

import { useState, useTransition } from "react";
import {
  addToCartAction,
  type CartActionState,
} from "@/app/store/actions/cart";
import { useCartCount } from "@/components/store/cart-count-context";

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
  const { addOptimistic, setCount } = useCartCount();
  const [message, setMessage] = useState<CartActionState>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!availableForSale || isPending) return;

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
    <div className={className}>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="merchandiseId" value={merchandiseId} />
        <input type="hidden" name="quantity" value={1} />
        <button
          type="submit"
          disabled={!availableForSale}
          onClick={(ev) => ev.stopPropagation()}
          className="w-full rounded-full border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-600 dark:bg-zinc-950 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
        >
          Add to cart
        </button>
      </form>
      {message.error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message.error}</p>
      ) : null}
      {message.success ? (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
          Added!
        </p>
      ) : null}
    </div>
  );
}
