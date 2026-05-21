import { NextResponse } from "next/server";
import {
  getAllShopifyCustomers,
  getShopifyCustomers,
} from "@/lib/shopify/customers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    const after = searchParams.get("after");
    const firstParam = searchParams.get("first");
    const first = firstParam ? Number(firstParam) : undefined;

    if (firstParam && (!Number.isFinite(first) || first! < 1)) {
      return NextResponse.json(
        { error: "first must be a positive number" },
        { status: 400 },
      );
    }

    if (all) {
      const customers = await getAllShopifyCustomers({ pageSize: first ?? 50 });
      return NextResponse.json({ customers, count: customers.length });
    }

    const result = await getShopifyCustomers({
      first,
      after,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load customers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
