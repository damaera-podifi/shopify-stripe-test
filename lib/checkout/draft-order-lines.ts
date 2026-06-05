import type { CheckoutLineItemMeta } from "./types";

export const MEMBERSHIP_PRICING_DISCOUNT_TITLE = "Membership pricing";
export const MEMBERSHIP_PRICING_DISCOUNT_DESCRIPTION =
  "Active membership member discount";

export function lineMembershipDiscountAmount(
  item: CheckoutLineItemMeta,
): number {
  if (!item.unitPrice || !item.originalUnitPrice) {
    return 0;
  }

  const perUnit = Number(item.originalUnitPrice) - Number(item.unitPrice);
  if (!Number.isFinite(perUnit) || perUnit <= 0) {
    return 0;
  }

  return perUnit * item.quantity;
}

export function totalMembershipDiscountFromLines(
  lineItems: CheckoutLineItemMeta[],
): number {
  return lineItems.reduce(
    (sum, item) => sum + lineMembershipDiscountAmount(item),
    0,
  );
}

/** Line input for draftOrderCreate — shows named discounts in Shopify admin. */
export function buildDraftOrderLineItemInput(item: CheckoutLineItemMeta) {
  const base = {
    variantId: item.variantId,
    quantity: item.quantity,
  };

  const lineDiscount = lineMembershipDiscountAmount(item);

  if (lineDiscount > 0.001) {
    return {
      ...base,
      appliedDiscount: {
        title: MEMBERSHIP_PRICING_DISCOUNT_TITLE,
        description: MEMBERSHIP_PRICING_DISCOUNT_DESCRIPTION,
        value: Math.round(lineDiscount * 100) / 100,
        valueType: "FIXED_AMOUNT" as const,
      },
    };
  }

  // Legacy payments: only unitPrice captured — fall back to silent override.
  if (item.unitPrice && item.currencyCode) {
    return {
      ...base,
      priceOverride: {
        amount: item.unitPrice,
        currencyCode: item.currencyCode,
      },
    };
  }

  return base;
}

export function buildDraftOrderNote(
  paymentIntentId: string,
  lineItems: CheckoutLineItemMeta[],
  options?: {
    voucherDiscountAmount?: number;
    discountCodes?: string[];
  },
): string {
  const savings = totalMembershipDiscountFromLines(lineItems);
  let note = `Paid via Stripe PaymentIntent ${paymentIntentId}`;

  if (savings > 0) {
    note += `\n${MEMBERSHIP_PRICING_DISCOUNT_TITLE}: $${savings.toFixed(2)} total savings.`;
  }

  const voucherDiscountAmount = options?.voucherDiscountAmount ?? 0;
  if (voucherDiscountAmount > 0) {
    const codes = options?.discountCodes?.length
      ? options.discountCodes.join(", ")
      : "promo";
    note += `\nPromo (${codes}): $${voucherDiscountAmount.toFixed(2)} total savings.`;
  }

  return note;
}

export function buildOrderLevelAppliedDiscount(options: {
  membershipDiscountAmount: number;
  voucherDiscountAmount: number;
  discountCodes: string[];
  hasLineDiscounts: boolean;
}) {
  const parts: Array<{ title: string; amount: number }> = [];

  if (!options.hasLineDiscounts && options.membershipDiscountAmount > 0) {
    parts.push({
      title: MEMBERSHIP_PRICING_DISCOUNT_TITLE,
      amount: options.membershipDiscountAmount,
    });
  }

  if (options.voucherDiscountAmount > 0) {
    const codeLabel = options.discountCodes.length
      ? options.discountCodes.join(", ")
      : "Promo";
    parts.push({
      title: `Promo: ${codeLabel}`,
      amount: options.voucherDiscountAmount,
    });
  }

  if (parts.length === 0) {
    return undefined;
  }

  const total = parts.reduce((sum, part) => sum + part.amount, 0);

  return {
    title: parts.length === 1 ? parts[0].title : "Order discounts",
    description:
      parts.length === 1
        ? parts[0].title
        : parts
            .map((part) => `${part.title}: $${part.amount.toFixed(2)}`)
            .join("; "),
    value: Math.round(total * 100) / 100,
    valueType: "FIXED_AMOUNT" as const,
  };
}
