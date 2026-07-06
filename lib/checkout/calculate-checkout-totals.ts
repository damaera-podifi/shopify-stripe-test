import {
  buildDraftOrderLineItemInput,
  buildOrderLevelAppliedDiscount,
  CHECKOUT_TAXES_INCLUDED,
  lineMembershipDiscountAmount,
} from "./draft-order-lines";
import type {
  CheckoutLineItemMeta,
  CheckoutShippingInput,
  CheckoutShippingLine,
  CheckoutTaxLine,
} from "./types";
import { adminGraphql } from "@/lib/shopify/admin";

export type CalculatedCheckoutTotals = {
  subtotalAmount: string;
  shippingAmount: string;
  shippingTitle: string;
  shippingRateHandle?: string;
  taxAmount: string;
  taxLines: CheckoutTaxLine[];
  totalAmount: string;
  currencyCode: string;
};

type DraftOrderShippingRate = {
  handle: string;
  title: string;
  price: { amount: string };
};

type CalculatedDraftOrder = {
  taxesIncluded: boolean;
  subtotalPriceSet: {
    presentmentMoney: { amount: string; currencyCode: string };
  };
  totalTaxSet: {
    presentmentMoney: { amount: string; currencyCode: string };
  };
  totalPriceSet: {
    presentmentMoney: { amount: string; currencyCode: string };
  };
  taxLines: Array<{
    title: string;
    rate: number;
    priceSet: {
      presentmentMoney: { amount: string };
    };
  }>;
  availableShippingRates: DraftOrderShippingRate[];
  shippingLine: {
    title: string;
    shippingRateHandle: string | null;
    originalPriceSet: {
      presentmentMoney: { amount: string; currencyCode: string };
    };
  } | null;
};

const DRAFT_ORDER_CALCULATE_MUTATION = `#graphql
  mutation DraftOrderCalculate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        taxesIncluded
        subtotalPriceSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        totalPriceSet {
          presentmentMoney {
            amount
            currencyCode
          }
        }
        taxLines {
          title
          rate
          priceSet {
            presentmentMoney {
              amount
            }
          }
        }
        availableShippingRates {
          handle
          title
          price {
            amount
          }
        }
        shippingLine {
          title
          shippingRateHandle
          originalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
        }
      }
      userErrors {
        message
      }
    }
  }
`;

function mailingAddress(shipping: CheckoutShippingInput) {
  return {
    firstName: shipping.firstName,
    lastName: shipping.lastName,
    address1: shipping.address1,
    address2: shipping.address2 || undefined,
    city: shipping.city,
    provinceCode: shipping.province,
    countryCode: shipping.country,
    zip: shipping.zip,
  };
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function selectDefaultShippingRate(
  rates: DraftOrderShippingRate[],
): DraftOrderShippingRate | null {
  if (rates.length === 0) {
    return null;
  }

  return rates.reduce((cheapest, rate) => {
    const price = Number(rate.price.amount);
    const cheapestPrice = Number(cheapest.price.amount);
    return price < cheapestPrice ? rate : cheapest;
  });
}

function buildShippingLineInput(rate: DraftOrderShippingRate) {
  if (rate.handle) {
    return { shippingRateHandle: rate.handle };
  }

  return {
    title: rate.title,
    price: rate.price.amount,
  };
}

function resolveShippingLine(
  calculated: CalculatedDraftOrder,
  selectedRate: DraftOrderShippingRate | null,
): CheckoutShippingLine {
  const fromCalculated = calculated.shippingLine;
  if (fromCalculated) {
    return {
      title: fromCalculated.title,
      amount: fromCalculated.originalPriceSet.presentmentMoney.amount,
      rateHandle: fromCalculated.shippingRateHandle ?? selectedRate?.handle,
    };
  }

  if (selectedRate) {
    return {
      title: selectedRate.title,
      amount: selectedRate.price.amount,
      rateHandle: selectedRate.handle,
    };
  }

  return { title: "Shipping", amount: "0.00" };
}

/**
 * When the shop has tax-inclusive prices, derive an effective rate from Shopify's
 * draft calculation and apply it to the customer-facing post-discount subtotal.
 */
function resolveTaxExclusiveTotals(options: {
  postDiscountSubtotal: number;
  shopifySubtotal: number;
  shopifyTax: number;
  shopifyShipping: number;
  shopifyTotal: number;
  taxesIncluded: boolean;
}): Pick<
  CalculatedCheckoutTotals,
  "subtotalAmount" | "taxAmount" | "totalAmount"
> {
  const taxableSubtotal =
    options.postDiscountSubtotal > 0
      ? options.postDiscountSubtotal
      : options.shopifySubtotal;

  let tax = options.shopifyTax;

  if (
    options.taxesIncluded &&
    options.shopifySubtotal > 0 &&
    options.shopifyTax > 0
  ) {
    const effectiveRate = options.shopifyTax / options.shopifySubtotal;
    tax = roundMoney(taxableSubtotal * effectiveRate);
  }

  if (!CHECKOUT_TAXES_INCLUDED) {
    const total = roundMoney(
      taxableSubtotal + tax + options.shopifyShipping,
    );
    return {
      subtotalAmount: taxableSubtotal.toFixed(2),
      taxAmount: tax.toFixed(2),
      totalAmount: total.toFixed(2),
    };
  }

  return {
    subtotalAmount: options.shopifySubtotal.toFixed(2),
    taxAmount: options.shopifyTax.toFixed(2),
    totalAmount: options.shopifyTotal.toFixed(2),
  };
}

function resolveTaxLines(
  shopifyTaxLines: Array<{ title: string; amount: number; rate?: number }>,
  options: {
    shopifyTax: number;
    resolvedTax: number;
    taxesIncluded: boolean;
  },
): CheckoutTaxLine[] {
  if (shopifyTaxLines.length === 0 || options.resolvedTax <= 0) {
    return [];
  }

  let lines: CheckoutTaxLine[];

  if (
    options.taxesIncluded &&
    options.shopifyTax > 0 &&
    Math.abs(options.resolvedTax - options.shopifyTax) > 0.001
  ) {
    const scale = options.resolvedTax / options.shopifyTax;
    lines = shopifyTaxLines.map((line) => ({
      title: line.title,
      amount: roundMoney(line.amount * scale).toFixed(2),
      ...(line.rate != null ? { rate: line.rate } : {}),
    }));
  } else {
    lines = shopifyTaxLines.map((line) => ({
      title: line.title,
      amount: roundMoney(line.amount).toFixed(2),
      ...(line.rate != null ? { rate: line.rate } : {}),
    }));
  }

  const lineSum = lines.reduce((sum, line) => sum + Number(line.amount), 0);
  const diff = roundMoney(options.resolvedTax - lineSum);
  if (diff !== 0 && lines.length > 0) {
    const last = lines[lines.length - 1];
    last.amount = roundMoney(Number(last.amount) + diff).toFixed(2);
  }

  return lines;
}

async function runDraftOrderCalculate(
  input: Record<string, unknown>,
): Promise<CalculatedDraftOrder> {
  const data = await adminGraphql<{
    draftOrderCalculate: {
      calculatedDraftOrder: CalculatedDraftOrder | null;
      userErrors: Array<{ message: string }>;
    };
  }>(DRAFT_ORDER_CALCULATE_MUTATION, { input }, { operation: "draftOrderCalculate" });

  const errors = data.draftOrderCalculate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  const calculated = data.draftOrderCalculate.calculatedDraftOrder;
  if (!calculated) {
    throw new Error("Failed to calculate checkout totals");
  }

  return calculated;
}

/** Uses Admin draftOrderCalculate so tax and shipping match Shopify order fulfillment. */
export async function calculateCheckoutTotals(
  shipping: CheckoutShippingInput,
  lineItems: CheckoutLineItemMeta[],
  options: {
    shopifyCustomerId?: string;
    membershipDiscountAmount: number;
    voucherDiscountAmount: number;
    discountCodes: string[];
    postDiscountSubtotal: number;
  },
): Promise<CalculatedCheckoutTotals> {
  const hasLineDiscounts = lineItems.some(
    (item) => lineMembershipDiscountAmount(item) > 0,
  );
  const orderLevelAppliedDiscount = buildOrderLevelAppliedDiscount({
    membershipDiscountAmount: options.membershipDiscountAmount,
    voucherDiscountAmount: options.voucherDiscountAmount,
    discountCodes: options.discountCodes,
    hasLineDiscounts,
  });

  const baseInput = {
    email: shipping.email,
    ...(options.shopifyCustomerId
      ? { customerId: options.shopifyCustomerId }
      : {}),
    lineItems: lineItems.map((item) => buildDraftOrderLineItemInput(item)),
    ...(orderLevelAppliedDiscount
      ? { appliedDiscount: orderLevelAppliedDiscount }
      : {}),
    shippingAddress: mailingAddress(shipping),
    billingAddress: mailingAddress(shipping),
  };

  const initial = await runDraftOrderCalculate(baseInput);
  const selectedRate = selectDefaultShippingRate(initial.availableShippingRates);

  const calculated = selectedRate
    ? await runDraftOrderCalculate({
        ...baseInput,
        shippingLine: buildShippingLineInput(selectedRate),
      })
    : initial;

  const shippingLine = resolveShippingLine(calculated, selectedRate);
  const shopifyShipping = Number(shippingLine.amount);

  const shopifySubtotal = Number(
    calculated.subtotalPriceSet.presentmentMoney.amount,
  );
  const shopifyTax = Number(calculated.totalTaxSet.presentmentMoney.amount);
  const shopifyTotal = Number(calculated.totalPriceSet.presentmentMoney.amount);
  const currencyCode = calculated.totalPriceSet.presentmentMoney.currencyCode;

  const resolved = resolveTaxExclusiveTotals({
    postDiscountSubtotal: options.postDiscountSubtotal,
    shopifySubtotal,
    shopifyTax,
    shopifyShipping,
    shopifyTotal,
    taxesIncluded: calculated.taxesIncluded,
  });

  const shopifyTaxLines = calculated.taxLines.map((line) => ({
    title: line.title,
    amount: Number(line.priceSet.presentmentMoney.amount),
    rate: line.rate,
  }));

  return {
    ...resolved,
    shippingAmount: shippingLine.amount,
    shippingTitle: shippingLine.title,
    ...(shippingLine.rateHandle
      ? { shippingRateHandle: shippingLine.rateHandle }
      : {}),
    taxLines: resolveTaxLines(shopifyTaxLines, {
      shopifyTax,
      resolvedTax: Number(resolved.taxAmount),
      taxesIncluded: calculated.taxesIncluded,
    }),
    currencyCode,
  };
}
