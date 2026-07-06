import Image from "next/image";
import type { OrderDetails } from "@/lib/checkout/order-details";
import { formatTaxLineLabel } from "@/lib/checkout/format-tax-rate";
import { formatPrice } from "@/lib/shopify/products";

function StatusBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

export function OrderSummary({ order }: { order: OrderDetails }) {
  const placedAt = new Date(order.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const taxAmount = Number(order.tax.amount);
  const showTaxLines = order.taxLines.length > 0;
  const showAggregateTax = !showTaxLines && taxAmount > 0.001;

  return (
    <div className="mt-8 space-y-6 text-left">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusBadge label="Payment" value={order.financialStatus} />
        <StatusBadge
          label="Fulfillment"
          value={
            order.cancelledAt ? "Cancelled" : order.fulfillmentStatus
          }
        />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Order {order.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Placed {placedAt}
            </p>
          </div>
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {formatPrice(order.total.amount, order.total.currencyCode)}
          </p>
        </div>

        <ul className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
          {order.lineItems.map((item, index) => {
            const lineTotal = Number(item.unitPrice.amount) * item.quantity;

            return (
              <li key={`${item.title}-${index}`} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                  {item.image ? (
                    <Image
                      src={item.image.url}
                      alt={item.image.altText ?? item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {item.title}
                  </p>
                  {item.variantTitle && item.variantTitle !== "Default Title" ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {item.variantTitle}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Qty {item.quantity} ×{" "}
                    {formatPrice(
                      item.unitPrice.amount,
                      item.unitPrice.currencyCode,
                    )}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(
                      String(lineTotal),
                      item.unitPrice.currencyCode,
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
            <span>Subtotal</span>
            <span>
              {formatPrice(order.subtotal.amount, order.subtotal.currencyCode)}
            </span>
          </div>
          {showTaxLines
            ? order.taxLines.map((line) => (
                <div
                  key={line.title}
                  className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400"
                >
                  <span>{formatTaxLineLabel(line.title, line.rate)}</span>
                  <span>
                    {order.taxesIncluded ? "" : "+"}
                    {formatPrice(line.amount, order.tax.currencyCode)}
                  </span>
                </div>
              ))
            : null}
          {showAggregateTax ? (
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>{order.taxesIncluded ? "Tax (included)" : "Tax"}</span>
              <span>
                {order.taxesIncluded ? "" : "+"}
                {formatPrice(order.tax.amount, order.tax.currencyCode)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-base font-semibold text-zinc-900 dark:text-zinc-50">
            <span>Total</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              {formatPrice(order.total.amount, order.total.currencyCode)}
            </span>
          </div>
        </div>
      </section>

      {order.tracking.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tracking
          </h2>
          <ul className="mt-3 space-y-3">
            {order.tracking.map((entry, index) => (
              <li
                key={`${entry.number ?? "tracking"}-${index}`}
                className="text-sm text-zinc-700 dark:text-zinc-300"
              >
                {entry.company ? (
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {entry.company}
                  </p>
                ) : null}
                {entry.number ? (
                  <p className="mt-1 font-mono text-zinc-600 dark:text-zinc-400">
                    {entry.number}
                  </p>
                ) : null}
                {entry.url ? (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    Track shipment
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
