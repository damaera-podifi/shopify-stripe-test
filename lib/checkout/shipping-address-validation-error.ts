export class ShippingAddressValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingAddressValidationError";
  }
}
