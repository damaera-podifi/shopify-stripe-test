import {
  buildDraftOrderLineItemInput,
  buildOrderLevelAppliedDiscount,
  CHECKOUT_TAXES_INCLUDED,
  lineMembershipDiscountAmount,
} from "./draft-order-lines";
import type { CheckoutLineItemMeta, CheckoutShippingInput } from "./types";
import { adminGraphql } from "@/lib/shopify/admin";

export type CalculatedCheckoutTotals = {
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode: string;
};

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

/**
 * When the shop has tax-inclusive prices, derive an effective rate from Shopify's
 * draft calculation and apply it to the customer-facing post-discount subtotal.
 */
function resolveTaxExclusiveTotals(options: {
  postDiscountSubtotal: number;
  shopifySubtotal: number;
  shopifyTax: number;
  shopifyTotal: number;
  taxesIncluded: boolean;
  currencyCode: string;
}): Pick<CalculatedCheckoutTotals, "subtotalAmount" | "taxAmount" | "totalAmount"> {
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
    const total = roundMoney(taxableSubtotal + tax);
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

/** Uses Admin draftOrderCalculate so tax matches Shopify order fulfillment. */
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

  const mutation = `#graphql
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
        }
        userErrors {
          message
        }
      }
    }
  `;

  const data = await adminGraphql<{
    draftOrderCalculate: {
      calculatedDraftOrder: {
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
      } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    mutation,
    {
      input: {
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
      },
    },
    { operation: "draftOrderCalculate" },
  );

  const errors = data.draftOrderCalculate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  const calculated = data.draftOrderCalculate.calculatedDraftOrder;
  if (!calculated) {
    throw new Error("Failed to calculate checkout totals");
  }

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
    shopifyTotal,
    taxesIncluded: calculated.taxesIncluded,
    currencyCode,
  });

  return {
    ...resolved,
    currencyCode,
  };
}
