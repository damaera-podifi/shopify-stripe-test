"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderDetails } from "@/lib/checkout/order-details";

const RETURN_REASONS = [
  { value: "WRONG_ITEM", label: "Wrong item" },
  { value: "SIZE_TOO_SMALL", label: "Too small" },
  { value: "SIZE_TOO_LARGE", label: "Too large" },
  { value: "UNWANTED", label: "Changed my mind" },
  { value: "DEFECTIVE", label: "Defective or damaged" },
  { value: "STYLE", label: "Style" },
  { value: "COLOR", label: "Color" },
  { value: "OTHER", label: "Other" },
] as const;

type OrderActionsPanelProps = {
  order: OrderDetails;
};

export function OrderActionsPanel({ order }: OrderActionsPanelProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<
    "reorder" | "cancel" | "return" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        order.returnableLineItems.map((item) => [
          item.fulfillmentLineItemId,
          false,
        ]),
      ),
  );
  const [returnReason, setReturnReason] = useState<string>("UNWANTED");
  const [returnNote, setReturnNote] = useState("");

  async function handleReorder() {
    setPendingAction("reorder");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to add items to cart");
      }

      router.push("/store/cart");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder");
      setPendingAction(null);
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      "Cancel this order and refund your payment? This cannot be undone.",
    );
    if (!confirmed) return;

    setPendingAction("cancel");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to cancel order");
      }

      setMessage("Order cancelled and Stripe refund initiated.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel order");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReturnRequest() {
    const items = order.returnableLineItems
      .filter((item) => selectedItems[item.fulfillmentLineItemId])
      .map((item) => ({
        fulfillmentLineItemId: item.fulfillmentLineItemId,
        quantity: item.quantity,
        returnReason,
        customerNote: returnNote.trim() || undefined,
      }));

    if (items.length === 0) {
      setError("Select at least one item to return.");
      return;
    }

    setPendingAction("return");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/orders/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          items,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        name?: string;
        status?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to request return");
      }

      setMessage(
        `Return ${data.name ?? "request"} submitted (${data.status ?? "REQUESTED"}). A merchant will review it in Shopify.`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to request return");
    } finally {
      setPendingAction(null);
    }
  }

  const showActions =
    order.canReorder || order.canCancel || order.canRequestReturn;

  if (!showActions && order.returns.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Order actions
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Reorder, cancel unfulfilled orders, or request a return after shipment.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {order.canReorder ? (
          <button
            type="button"
            onClick={handleReorder}
            disabled={pendingAction !== null}
            className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600"
          >
            {pendingAction === "reorder" ? "Adding to cart..." : "Buy again"}
          </button>
        ) : null}

        {order.canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pendingAction !== null}
            className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {pendingAction === "cancel" ? "Cancelling..." : "Cancel order"}
          </button>
        ) : null}
      </div>

      {order.canCancel ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Cancelling will restock items in Shopify and issue a full refund through Stripe.
        </p>
      ) : null}

      {order.returns.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Returns
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {order.returns.map((item) => (
              <li key={item.id}>
                {item.name} — {item.status}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {order.canRequestReturn ? (
        <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Request a return
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Submit a return request for merchant approval. Refunds are processed after the return is approved and received.
            </p>
          </div>

          <ul className="space-y-2">
            {order.returnableLineItems.map((item) => (
              <li key={item.fulfillmentLineItemId} className="flex items-start gap-3">
                <input
                  id={item.fulfillmentLineItemId}
                  type="checkbox"
                  checked={selectedItems[item.fulfillmentLineItemId] ?? false}
                  onChange={(event) =>
                    setSelectedItems((current) => ({
                      ...current,
                      [item.fulfillmentLineItemId]: event.target.checked,
                    }))
                  }
                  className="mt-1"
                />
                <label
                  htmlFor={item.fulfillmentLineItemId}
                  className="text-sm text-zinc-700 dark:text-zinc-300"
                >
                  {item.title}
                  {item.variantTitle && item.variantTitle !== "Default Title"
                    ? ` — ${item.variantTitle}`
                    : ""}{" "}
                  (Qty {item.quantity})
                </label>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="return-reason"
                className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
              >
                Reason
              </label>
              <select
                id="return-reason"
                value={returnReason}
                onChange={(event) => setReturnReason(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {RETURN_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="return-note"
                className="block text-xs font-medium uppercase tracking-wide text-zinc-500"
              >
                Note
              </label>
              <input
                id="return-note"
                type="text"
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
                placeholder="Optional details"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleReturnRequest}
            disabled={pendingAction !== null}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {pendingAction === "return" ? "Submitting..." : "Request return"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
