import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressValidationTestForm } from "@/components/store/address-validation-test-form";

export const metadata = {
  title: "Address validation test | MLPA Health",
  description: "Compare Shopify address validation methods",
};

export default function AddressValidationTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 space-y-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/store" className="underline hover:text-zinc-700 dark:hover:text-zinc-200">
            Store
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Address validation test
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Dev-only page to compare Shopify address checks. Admin methods use a
          throwaway draft order probe and do not require a cart. The Storefront
          cart method is optional and uses the current cart cookie.
        </p>
      </div>

      <AddressValidationTestForm />
    </main>
  );
}
