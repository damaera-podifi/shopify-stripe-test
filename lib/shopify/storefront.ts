import {
  getShopifyStoreDomain,
  getShopifyStorefrontToken,
  SHOPIFY_API_VERSION,
} from "./config";

type StorefrontResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function storefrontRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { cache?: RequestCache; revalidate?: number | false },
): Promise<T> {
  const domain = getShopifyStoreDomain();
  const token = getShopifyStorefrontToken();

  const response = await fetch(
    `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: options?.cache,
      ...(options?.revalidate !== undefined
        ? { next: { revalidate: options.revalidate } }
        : {}),
    },
  );

  if (!response.ok) {
    throw new Error(`Storefront API request failed (${response.status})`);
  }

  const json = (await response.json()) as StorefrontResponse<T>;

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(", "));
  }

  if (!json.data) {
    throw new Error("Storefront API returned no data");
  }

  return json.data;
}

export async function storefrontQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { cache?: RequestCache; revalidate?: number | false },
): Promise<T> {
  if (options) {
    return storefrontRequest<T>(query, variables, options);
  }

  return storefrontRequest<T>(query, variables, { revalidate: 60 });
}

export async function storefrontMutation<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return storefrontRequest<T>(query, variables, {
    cache: "no-store",
    revalidate: false,
  });
}
