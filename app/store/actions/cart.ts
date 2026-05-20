"use server";

import { revalidatePath } from "next/cache";
import {
  addToCart as addToCartMutation,
  removeCartLine,
  updateCartLine,
} from "@/lib/shopify/cart";

function revalidateStorePaths() {
  revalidatePath("/store", "layout");
  revalidatePath("/store/cart");
  revalidatePath("/store/checkout");
}

export type CartActionState = {
  error?: string;
  success?: boolean;
};

export async function addToCartAction(
  _prevState: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const merchandiseId = formData.get("merchandiseId");
  const quantity = Number(formData.get("quantity") ?? 1);

  if (typeof merchandiseId !== "string" || !merchandiseId) {
    return { error: "Select a variant" };
  }

  if (!Number.isFinite(quantity) || quantity < 1) {
    return { error: "Quantity must be at least 1" };
  }

  try {
    await addToCartMutation(merchandiseId, quantity);
    revalidateStorePaths();
    return { success: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to add to cart",
    };
  }
}

export async function updateCartLineAction(formData: FormData): Promise<void> {
  const lineId = formData.get("lineId");
  const quantity = Number(formData.get("quantity"));

  if (typeof lineId !== "string" || !lineId) return;
  if (!Number.isFinite(quantity) || quantity < 1) return;

  await updateCartLine(lineId, quantity);
  revalidateStorePaths();
}

export async function removeCartLineAction(formData: FormData): Promise<void> {
  const lineId = formData.get("lineId");

  if (typeof lineId !== "string" || !lineId) return;

  await removeCartLine(lineId);
  revalidateStorePaths();
}
