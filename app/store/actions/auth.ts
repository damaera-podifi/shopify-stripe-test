"use server";

import { redirect } from "next/navigation";
import {
  authenticateStoreUser,
  clearStoreSession,
} from "@/lib/auth/session";

export type AuthActionState = {
  error?: string;
};

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/store/orders").trim();

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address" };
  }

  if (!password) {
    return { error: "Enter your password" };
  }

  const result = await authenticateStoreUser(email, password);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/store/orders");
}

export async function logoutAction(): Promise<void> {
  await clearStoreSession();
  redirect("/store");
}
