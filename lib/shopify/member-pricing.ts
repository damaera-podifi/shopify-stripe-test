import type { SessionUser } from "@/lib/auth/types";
import type { AdminMemberPricing } from "./admin-member-pricing";
import type { Cart, CartLine, CartMoney } from "./cart";

export type MemberPricingContext = {
  isMember: boolean;
  discountPercent: number | null;
  discountTitle: string;
};

export function getMemberDiscountPercent(): number | null {
  const raw = process.env.SHOPIFY_MEMBER_DISCOUNT_PERCENT?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value >= 100) return null;
  return value;
}

export function getMemberDiscountTitle(): string {
  return process.env.SHOPIFY_MEMBER_DISCOUNT_TITLE?.trim() || "Member discount";
}

export function applyPercentToMoney(
  money: CartMoney,
  percent: number,
): CartMoney {
  const amount = Number(money.amount);
  const discounted = amount * (1 - percent / 100);
  const decimals = money.amount.includes(".")
    ? (money.amount.split(".")[1]?.length ?? 2)
    : 0;
  return {
    amount: discounted.toFixed(decimals),
    currencyCode: money.currencyCode,
  };
}

/** Admin-style pricing object for product queries when DB membership is set. */
export function effectiveAdminMemberPricing(
  user: SessionUser | null,
  adminMemberPricing?: AdminMemberPricing | null,
): AdminMemberPricing | null {
  const discountPercent = getMemberDiscountPercent();
  if (user?.isMembership && discountPercent !== null) {
    return {
      isMember: true,
      discountPercent,
      discountTitle: getMemberDiscountTitle(),
      shopifyCustomerId:
        user.shopifyCustomerId ?? adminMemberPricing?.shopifyCustomerId ?? "",
    };
  }
  return adminMemberPricing ?? null;
}

export function getMemberPricingContext(
  user: SessionUser | null,
  adminMemberPricing?: AdminMemberPricing | null,
): MemberPricingContext {
  const discountPercent = getMemberDiscountPercent();
  const discountTitle = getMemberDiscountTitle();

  const isMember =
    Boolean(user?.isMembership) || Boolean(adminMemberPricing?.isMember);

  return {
    isMember,
    discountPercent: isMember ? discountPercent : null,
    discountTitle,
  };
}

function sumMoney(lines: Array<{ amount: number; currency: string }>): CartMoney {
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const currencyCode = lines[0]?.currency ?? "USD";
  return {
    amount: total.toFixed(2),
    currencyCode,
  };
}

/** Apply configured percent discount to cart lines and totals (admin / DB membership). */
export function applyMemberDiscountToCart(
  cart: Cart,
  pricing: MemberPricingContext,
): Cart {
  if (!pricing.isMember || pricing.discountPercent === null) {
    return cart;
  }

  const percent = pricing.discountPercent;
  let discountTotal = 0;

  const lines: CartLine[] = cart.lines.map((line) => {
    const publicPrice = line.merchandise.price;
    const memberPrice = applyPercentToMoney(publicPrice, percent);
    const publicAmount = Number(publicPrice.amount);
    const memberAmount = Number(memberPrice.amount);

    if (memberAmount >= publicAmount) {
      return line;
    }

    discountTotal += (publicAmount - memberAmount) * line.quantity;

    return {
      ...line,
      merchandise: {
        ...line.merchandise,
        price: memberPrice,
        compareAtPrice: publicPrice,
      },
    };
  });

  if (discountTotal <= 0) {
    return cart;
  }

  const currencyCode = cart.cost.totalAmount.currencyCode;
  const subtotalLines = lines.map((line) => ({
    amount: Number(line.merchandise.price.amount) * line.quantity,
    currency: line.merchandise.price.currencyCode,
  }));

  const subtotalAmount = sumMoney(subtotalLines);
  const discountMoney: CartMoney = {
    amount: discountTotal.toFixed(2),
    currencyCode,
  };

  return {
    ...cart,
    lines,
    cost: {
      subtotalAmount,
      totalAmount: subtotalAmount,
    },
    discountAllocations: [
      ...cart.discountAllocations,
      {
        discountedAmount: discountMoney,
        title: pricing.discountTitle,
      },
    ],
  };
}
