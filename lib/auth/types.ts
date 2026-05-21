/** Saved shipping details — prefills checkout and Stripe payment. */
export type UserCheckoutProfile = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
};

export type UserRecord = {
  id: string;
  email: string;
  password: string;
  shopifyCustomerId: string | null;
  /** Local membership flag — drives member pricing when SHOPIFY_MEMBER_DISCOUNT_PERCENT is set. */
  isMembership?: boolean;
  /** Prefilled at checkout / payment when present. */
  checkoutProfile?: UserCheckoutProfile;
  /** Storefront API token for segment / member pricing (from Customer Account OAuth). */
  shopifyStorefrontAccessToken?: string | null;
  shopifyStorefrontTokenExpiresAt?: string | null;
  createdAt: string;
};

export type UsersDatabase = {
  users: UserRecord[];
};

export type SessionUser = {
  id: string;
  email: string;
  shopifyCustomerId: string | null;
  isMembership: boolean;
  shopifyStorefrontAccessToken: string | null;
};
