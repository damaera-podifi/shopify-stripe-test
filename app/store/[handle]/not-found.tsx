import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-center">
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        This product does not exist or is no longer available.
      </p>
      <Link
        href="/store"
        className="mt-6 inline-block rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
      >
        Back to store
      </Link>
    </main>
  );
}
