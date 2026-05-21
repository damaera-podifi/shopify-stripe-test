import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/store/login-form";
import { getStoreSession } from "@/lib/auth/session";

export const metadata = {
  title: "Sign in | MLPA Health",
  description: "Sign in to view your orders",
};

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = params.redirect?.trim() || "/store/orders";
  const session = await getStoreSession();

  if (session) {
    redirect(redirectTo.startsWith("/") ? redirectTo : "/store/orders");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with the email and password from your account record.
        </p>
      </div>

      <div className="mt-8">
        <LoginForm redirectTo={redirectTo} />
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/store"
          className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Back to store
        </Link>
      </div>
    </main>
  );
}
