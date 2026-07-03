import { NextResponse } from "next/server";
import { getStoreSession } from "@/lib/auth/session";
import { getStoreListingMembershipPrices } from "@/lib/shopify/member-pricing";
import {
  getStoreProducts,
  STORE_PRODUCTS_PAGE_SIZE,
} from "@/lib/shopify/products";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const q = searchParams.get("q");
    const firstParam = searchParams.get("first");
    const first = firstParam
      ? Number.parseInt(firstParam, 10)
      : STORE_PRODUCTS_PAGE_SIZE;

    if (Number.isNaN(first)) {
      return NextResponse.json(
        { error: "Invalid page size" },
        { status: 400 },
      );
    }

    const data = await getStoreProducts({
      first,
      after: cursor,
      search: q,
    });

    const session = await getStoreSession();
    const memberPrices =
      session?.isMembershipActive && data.products.length > 0
        ? await getStoreListingMembershipPrices(data.products)
        : new Map();

    return NextResponse.json({
      products: data.products,
      pageInfo: data.pageInfo,
      memberPrices: Object.fromEntries(memberPrices),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load products";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
