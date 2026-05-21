import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth/login";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const user = await registerUser({
      email: body.email ?? "",
      password: body.password ?? "",
    });

    return NextResponse.json({
      user: {
        email: user.email,
        shopifyCustomerId: user.shopifyCustomerId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
