"use server";

import { redirect } from "next/navigation";
import {
  clearStoreSession,
  setStoreSession,
} from "@/lib/auth/session";

export type AuthActionState = {
  error?: string;
};

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/store/orders").trim();

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address" };
  }

  try {
    await setStoreSession(email);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not create a session. Check SESSION_SECRET.",
    };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/store/orders");
}

export async function logoutAction(): Promise<void> {
  await clearStoreSession();
  redirect("/store");
}
