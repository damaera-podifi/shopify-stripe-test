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
};
