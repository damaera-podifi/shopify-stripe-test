import Link from "next/link";
import type { OrderListItem } from "@/lib/checkout/order-details";
import { formatPrice } from "@/lib/shopify/products";

type OrderListProps = {
  email: string;
  orders: OrderListItem[];
};

export function OrderList({ email, orders }: OrderListProps) {
  if (orders.length === 0) {
    return (
      <p className="mt-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
        No orders found for{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-50">{email}</span>
        .
      </p>
    );
  }

  return (
    <ul className="mt-8 space-y-3">
      {orders.map((order) => {
        const placedAt = new Date(order.createdAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const detailHref = `/store/orders/detail?email=${encodeURIComponent(email)}&id=${encodeURIComponent(order.id)}`;

        return (
          <li key={order.id}>
            <Link
              href={detailHref}
              className="block rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    Order {order.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {placedAt}
                  </p>
                </div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {formatPrice(order.total.amount, order.total.currencyCode)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  Payment: {order.financialStatus}
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  Fulfillment: {order.fulfillmentStatus}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
