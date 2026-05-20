function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getShopifyStoreDomain(): string {
  const domain = requireEnv("SHOPIFY_STORE_DOMAIN");
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getShopifyStorefrontToken(): string {
  return requireEnv("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
}

export function getShopifyAdminToken(): string {
  return requireEnv("SHOPIFY_ADMIN_ACCESS_TOKEN");
}

export const SHOPIFY_API_VERSION = "2024-10";
