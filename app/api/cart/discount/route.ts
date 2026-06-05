import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  applyCartDiscountCode,
  clearCartDiscountCodes,
  getCart,
} from "@/lib/shopify/cart";
import {
  describeDiscountCodeFailure,
  getApplicableVoucherCodes,
} from "@/lib/shopify/cart-discounts";

function revalidateCartPages() {
  revalidatePath("/store/cart");
  revalidatePath("/store/checkout");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim();

    if (!code) {
      return NextResponse.json(
        { error: "Enter a discount code" },
        { status: 400 },
      );
    }

    const { cart, warnings } = await applyCartDiscountCode(code);
    const appliedCodes = getApplicableVoucherCodes(cart);

    revalidateCartPages();

    return NextResponse.json({
      cart,
      warnings,
      applied: appliedCodes.length > 0,
      message:
        appliedCodes.length > 0
          ? `Discount code "${appliedCodes[0]}" applied.`
          : describeDiscountCodeFailure(cart, warnings, code),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not apply discount";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const existing = await getCart();
    if (!existing) {
      return NextResponse.json({ error: "No cart found" }, { status: 400 });
    }

    const { cart } = await clearCartDiscountCodes();

    revalidateCartPages();

    return NextResponse.json({
      cart,
      applied: false,
      message: "Discount code removed.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not remove discount";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
