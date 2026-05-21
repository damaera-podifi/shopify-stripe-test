"use client";

import { useActionState } from "react";
import {
  loginAction,
  type AuthActionState,
} from "@/app/store/actions/auth";

type LoginFormProps = {
  redirectTo?: string;
  defaultEmail?: string;
};

export function LoginForm({
  redirectTo = "/store/orders",
  defaultEmail = "",
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="mx-auto max-w-md space-y-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="text-left">
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email address
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-emerald-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          This email defines your account. Checkout can use a different contact
          email, but orders stay linked to this sign-in.
        </p>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600"
      >
        {pending ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
