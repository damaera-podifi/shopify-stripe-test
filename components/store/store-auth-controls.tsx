import Link from "next/link";
import { logoutAction } from "@/app/store/actions/auth";
import type { StoreSession } from "@/lib/auth/session";

type StoreAuthControlsProps = {
  session: StoreSession | null;
};

export function StoreAuthControls({ session }: StoreAuthControlsProps) {
  if (session) {
    return (
      <>
        <span className="hidden max-w-[180px] truncate text-zinc-500 sm:inline dark:text-zinc-400">
          {session.email}
          {session.isMembershipActive ? " · Member" : " · Membership inactive"}
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-full border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </form>
      </>
    );
  }

  return (
    <Link
      href="/store/login?redirect=/store/orders"
      className="rounded-full border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      Sign in
    </Link>
  );
}
