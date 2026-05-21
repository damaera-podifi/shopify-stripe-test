import { NextResponse } from "next/server";
import { loginUser } from "@/lib/auth/login";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const user = await loginUser({
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
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
