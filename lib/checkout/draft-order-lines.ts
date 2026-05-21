import type { CheckoutLineItemMeta } from "./types";

/** Admin API line input — priceOverride replaces catalog price when variantId is set. */
export function toDraftOrderLineItems(lineItems: CheckoutLineItemMeta[]) {
  return lineItems.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    priceOverride: {
      amount: item.unitPrice,
      currencyCode: item.currencyCode,
    },
  }));
}
