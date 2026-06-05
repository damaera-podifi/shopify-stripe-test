import type { Cart, CartLine } from "./cart";

export type CartDiscountAllocationSource = "automatic" | "code";

export function lineDiscountBySource(
  line: CartLine,
  source: CartDiscountAllocationSource,
): number {
  return line.discountAllocations
    .filter((allocation) => allocation.source === source)
    .reduce(
      (sum, allocation) => sum + Number(allocation.discountedAmount.amount),
      0,
    );
}

export function computeMembershipDiscountAmount(cart: Cart): number {
  return cart.lines.reduce(
    (sum, line) => sum + lineDiscountBySource(line, "automatic"),
    0,
  );
}

function cartLevelCodeDiscountAmount(cart: Cart): number {
  return cart.cartDiscountAllocations
    .filter((allocation) => allocation.source === "code")
    .reduce(
      (sum, allocation) => sum + Number(allocation.discountedAmount.amount),
      0,
    );
}

export function computeVoucherDiscountAmount(cart: Cart): number {
  const fromLines = cart.lines.reduce(
    (sum, line) => sum + lineDiscountBySource(line, "code"),
    0,
  );
  const fromCart = cartLevelCodeDiscountAmount(cart);
  const fromAllocations = fromLines + fromCart;

  if (fromAllocations > 0) {
    return fromAllocations;
  }

  const hasApplicableCode = cart.discountCodes.some((entry) => entry.applicable);
  if (!hasApplicableCode) {
    return 0;
  }

  const displaySubtotal = computeCartDisplaySubtotal(cart);
  const cartTotal = Number(cart.cost.totalAmount.amount);
  const membership = computeMembershipDiscountAmount(cart);

  return Math.max(0, displaySubtotal - membership - cartTotal);
}

export function getVoucherDiscountLabel(cart: Cart): string {
  const codes = getApplicableVoucherCodes(cart);
  if (codes.length > 0) {
    return `Promo discount (${codes.join(", ")})`;
  }

  const allocationCodes = [
    ...cart.lines.flatMap((line) =>
      line.discountAllocations
        .filter((allocation) => allocation.source === "code" && allocation.code)
        .map((allocation) => allocation.code as string),
    ),
    ...cart.cartDiscountAllocations
      .filter((allocation) => allocation.source === "code" && allocation.code)
      .map((allocation) => allocation.code as string),
  ];

  const uniqueCodes = [...new Set(allocationCodes)];
  if (uniqueCodes.length > 0) {
    return `Promo discount (${uniqueCodes.join(", ")})`;
  }

  return "Promo discount";
}

export function getApplicableVoucherCodes(cart: Cart): string[] {
  return cart.discountCodes
    .filter((entry) => entry.applicable)
    .map((entry) => entry.code);
}

/** Sum line subtotals — pre-discount retail, for clearer totals UI. */
export function computeCartDisplaySubtotal(cart: Cart): number {
  return cart.lines.reduce(
    (sum, line) => sum + Number(line.cost.subtotalAmount.amount),
    0,
  );
}

export function describeDiscountCodeFailure(
  cart: Cart,
  warnings: Array<{ code: string; message: string }>,
  enteredCode: string,
): string {
  const warning = warnings[0];
  if (warning?.code === "DISCOUNT_NOT_FOUND") {
    return (
      `Code "${enteredCode}" was not found on the storefront. ` +
      "In Shopify Admin, confirm the discount is active and available to your online/headless sales channel."
    );
  }

  const onCart = cart.discountCodes.find(
    (entry) => entry.code.toLowerCase() === enteredCode.toLowerCase(),
  );

  if (onCart && !onCart.applicable) {
    return (
      `Code "${enteredCode}" is recognized but does not apply to this cart. ` +
      "Check product eligibility, quantities, and whether the code can combine with membership pricing."
    );
  }

  return (
    warning?.message ??
    `Code "${enteredCode}" could not be applied to this cart.`
  );
}
