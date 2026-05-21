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

export type CheckoutLineItemMeta = {
  variantId: string;
  quantity: number;
  /** Unit price charged (member price when applicable). */
  unitPrice: string;
  currencyCode: string;
  /** Catalog unit price before member discount, when applicable. */
  listUnitPrice?: string;
};
