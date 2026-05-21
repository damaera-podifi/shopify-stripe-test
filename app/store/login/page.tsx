import Link from "next/link";
import { AuthForm } from "@/components/store/auth-form";

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Sign in
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Dev accounts in{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
          data/users.json
        </code>
        : <strong>vip@example.com</strong> / <strong>user@example.com</strong> —
        password <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">password123</code>
      </p>
      <div className="mt-6">
        <AuthForm mode="login" />
      </div>
      <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
        No account?{" "}
        <Link
          href="/store/register"
          className="font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
