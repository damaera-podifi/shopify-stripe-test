import { APP_USER_ID_KEY, APP_USER_ID_NAMESPACE } from "@/lib/auth/user-id";
import { adminGraphql } from "@/lib/shopify/admin";
import { logCheckout } from "./logger";

export async function attachAppUserIdToOrder(
  shopifyOrderId: string,
  userId: string,
): Promise<void> {
  logCheckout("order_user_id_attach_start", { shopifyOrderId, userId });

  const data = await adminGraphql<{
    orderUpdate: {
      order: { id: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `#graphql
      mutation OrderUpdateUserId($input: OrderInput!) {
        orderUpdate(input: $input) {
          order {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      input: {
        id: shopifyOrderId,
        metafields: [
          {
            namespace: APP_USER_ID_NAMESPACE,
            key: APP_USER_ID_KEY,
            type: "single_line_text_field",
            value: userId,
          },
        ],
      },
    },
    { operation: "orderUpdateUserId" },
  );

  const errors = data.orderUpdate.userErrors;
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(", "));
  }

  logCheckout("order_user_id_attach_ok", { shopifyOrderId, userId });
}
