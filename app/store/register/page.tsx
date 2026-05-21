import Link from "next/link";
import { AuthForm } from "@/components/store/auth-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Create account
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        New users are appended to{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
          data/users.json
        </code>{" "}
        (plaintext password, dev only).
      </p>
      <div className="mt-6">
        <AuthForm mode="register" />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/store/login"
          className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
