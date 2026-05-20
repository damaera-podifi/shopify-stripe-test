type OrderEmailFormProps = {
  defaultEmail?: string;
  action?: string;
};

export function OrderEmailForm({
  defaultEmail = "",
  action = "/store/orders",
}: OrderEmailFormProps) {
  return (
    <form action={action} method="get" className="mx-auto max-w-md space-y-4">
      <div className="text-left">
        <label
          htmlFor="order-email"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Email address
        </label>
        <input
          id="order-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none ring-emerald-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Use the same email you entered at checkout.
        </p>
      </div>
      <button
        type="submit"
        className="w-full rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600"
      >
        View my orders
      </button>
    </form>
  );
}
