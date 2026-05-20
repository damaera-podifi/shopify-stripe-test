import {
  getShopifyAdminToken,
  getShopifyStoreDomain,
  SHOPIFY_API_VERSION,
} from "./config";

type AdminResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const domain = getShopifyStoreDomain();
  const token = getShopifyAdminToken();

  const response = await fetch(
    `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Admin API request failed (${response.status})`);
  }

  const json = (await response.json()) as AdminResponse<T>;

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(", "));
  }

  if (!json.data) {
    throw new Error("Admin API returned no data");
  }

  return json.data;
}
