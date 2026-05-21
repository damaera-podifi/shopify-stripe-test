import { getStoreSession } from "@/lib/auth/session";
import { syncMembershipCustomerForSession } from "./membership-sync-cache";
import { storefrontMutation } from "./storefront";

export type VariantMembershipPrice = {
  variantId: string;
  retailAmount: string;
  memberAmount: string;
  currencyCode: string;
  hasDiscount: boolean;
};

type PreviewCartLine = {
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
  merchandise: {
    id: string;
    price: { amount: string; currencyCode: string };
  };
};

function lineToMembershipPrice(line: PreviewCartLine): VariantMembershipPrice {
  const retailAmount = line.cost.subtotalAmount.amount;
  const memberAmount = line.cost.totalAmount.amount;

  return {
    variantId: line.merchandise.id,
    retailAmount,
    memberAmount,
    currencyCode: line.cost.totalAmount.currencyCode,
    hasDiscount: Number(memberAmount) < Number(retailAmount),
  };
}

async function previewMembershipPricesForVariants(
  variantIds: string[],
): Promise<Map<string, VariantMembershipPrice>> {
  const prices = new Map<string, VariantMembershipPrice>();
  const session = await getStoreSession();

  if (!session?.isMembershipActive || variantIds.length === 0) {
    return prices;
  }

  await syncMembershipCustomerForSession(
    session.email,
    session.isMembershipActive,
  );

  const uniqueVariantIds = [...new Set(variantIds)];
  const previewLineLimit = 50;

  for (let index = 0; index < uniqueVariantIds.length; index += previewLineLimit) {
    const chunk = uniqueVariantIds.slice(index, index + previewLineLimit);
    const lineCount = chunk.length;

    const data = await storefrontMutation<{
      cartCreate: {
        cart: {
          lines: {
            edges: Array<{ node: PreviewCartLine }>;
          };
        } | null;
        userErrors: Array<{ message: string }>;
      };
    }>(
      `#graphql
        mutation PreviewMemberPrices($input: CartInput!) {
          cartCreate(input: $input) {
            cart {
              lines(first: ${lineCount}) {
                edges {
                  node {
                    cost {
                      subtotalAmount {
                        amount
                        currencyCode
                      }
                      totalAmount {
                        amount
                        currencyCode
                      }
                    }
                    merchandise {
                      ... on ProductVariant {
                        id
                        price {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
            userErrors {
              message
            }
          }
        }
      `,
      {
        input: {
          lines: chunk.map((variantId) => ({
            merchandiseId: variantId,
            quantity: 1,
          })),
          buyerIdentity: {
            email: session.email,
          },
        },
      },
    );

    const errors = data.cartCreate.userErrors;
    if (errors.length || !data.cartCreate.cart) {
      continue;
    }

    for (const edge of data.cartCreate.cart.lines.edges) {
      const price = lineToMembershipPrice(edge.node);
      prices.set(price.variantId, price);
    }
  }

  return prices;
}

export async function getVariantMembershipPrice(
  variantId: string,
): Promise<VariantMembershipPrice | null> {
  const prices = await previewMembershipPricesForVariants([variantId]);
  return prices.get(variantId) ?? null;
}

export async function getProductMembershipPrices(
  variantIds: string[],
): Promise<Map<string, VariantMembershipPrice>> {
  return previewMembershipPricesForVariants(variantIds);
}

export async function getStoreListingMembershipPrices(
  products: Array<{ id: string; variants: Array<{ id: string }> }>,
): Promise<Map<string, VariantMembershipPrice>> {
  const variantIds = products
    .map((product) => product.variants[0]?.id)
    .filter((variantId): variantId is string => Boolean(variantId));

  const pricesByVariant = await previewMembershipPricesForVariants(variantIds);
  const pricesByProduct = new Map<string, VariantMembershipPrice>();

  for (const product of products) {
    const variantId = product.variants[0]?.id;
    if (!variantId) {
      continue;
    }

    const price = pricesByVariant.get(variantId);
    if (price) {
      pricesByProduct.set(product.id, price);
    }
  }

  return pricesByProduct;
}
