import { NextResponse } from "next/server";
import { runAddressValidationComparison } from "@/lib/checkout/address-validation-methods";
import { parseShippingFromBody } from "@/lib/checkout/validate-shipping";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const shippingResult = parseShippingFromBody(body);

    if ("error" in shippingResult) {
      return NextResponse.json({ error: shippingResult.error }, { status: 400 });
    }

    const includeCartMethod = body.includeCartMethod !== false;
    const results = await runAddressValidationComparison(shippingResult, {
      includeCartMethod,
    });

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
