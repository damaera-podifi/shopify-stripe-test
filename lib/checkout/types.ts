export type CheckoutShippingInput = {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  zip: string;
  country: string;
};

export type CheckoutTaxLine = {
  title: string;
  amount: string;
  /** Decimal rate from Shopify (e.g. 0.06 = 6%). */
  rate?: number;
};

export type CheckoutLineItemMeta = {
  variantId: string;
  quantity: number;
  /** Discounted unit price the customer paid (presentment currency). */
  unitPrice?: string;
  /** Pre-discount unit price for display on the Shopify order. */
  originalUnitPrice?: string;
  currencyCode?: string;
};
