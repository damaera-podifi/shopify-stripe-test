import type { CheckoutShippingInput } from "./types";
import { ShippingAddressValidationError } from "./shipping-address-validation-error";
import { validateShippingAddressWithShopify } from "./validate-shipping";
import { adminGraphql } from "@/lib/shopify/admin";

export type AddressValidationMethodResult = {
  method: "storefront_cart_strict" | "admin_draft_order_calculate" | "admin_draft_order_validation_summary";
  label: string;
  requiresCart: boolean;
  ok: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, unknown>;
};

function mailingAddress(shipping: CheckoutShippingInput) {
  return {
    firstName: shipping.firstName,
    lastName: shipping.lastName,
    address1: shipping.address1,
    address2: shipping.address2 || undefined,
    city: shipping.city,
    provinceCode: shipping.province,
    countryCode: shipping.country,
    zip: shipping.zip,
  };
}

function probeDraftOrderInput(shipping: CheckoutShippingInput) {
  return {
    email: shipping.email,
    shippingAddress: mailingAddress(shipping),
    billingAddress: mailingAddress(shipping),
    lineItems: [
      {
        title: "Address validation probe",
        quantity: 1,
        originalUnitPrice: "1.00",
      },
    ],
  };
}

export async function validateAddressViaStorefrontCartStrict(
  shipping: CheckoutShippingInput,
): Promise<AddressValidationMethodResult> {
  try {
    await validateShippingAddressWithShopify(shipping);
    return {
      method: "storefront_cart_strict",
      label: "Storefront cart (STRICT)",
      requiresCart: true,
      ok: true,
      errors: [],
      warnings: [],
      details: { note: "Cart delivery address updated with STRICT validation." },
    };
  } catch (error) {
    const message =
      error instanceof ShippingAddressValidationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Address validation failed";

    return {
      method: "storefront_cart_strict",
      label: "Storefront cart (STRICT)",
      requiresCart: true,
      ok: false,
      errors: [message],
      warnings: [],
      details: {},
    };
  }
}

export async function validateAddressViaDraftOrderCalculate(
  shipping: CheckoutShippingInput,
): Promise<AddressValidationMethodResult> {
  const mutation = `#graphql
    mutation DraftOrderCalculate($input: DraftOrderInput!) {
      draftOrderCalculate(input: $input) {
        calculatedDraftOrder {
          availableShippingRates {
            title
            price {
              amount
            }
          }
          warnings {
            errorCode
            field
            message
          }
          alerts {
            title
            content
            severity
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await adminGraphql<{
    draftOrderCalculate: {
      calculatedDraftOrder: {
        availableShippingRates: Array<{
          title: string;
          price: { amount: string };
        }>;
        warnings: Array<{
          errorCode: string | null;
          field: string[] | null;
          message: string;
        }>;
        alerts: Array<{
          title: string;
          content: string;
          severity: string;
        }>;
      } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(mutation, { input: probeDraftOrderInput(shipping) }, {
    operation: "addressValidationDraftOrderCalculate",
  });

  const userErrors = data.draftOrderCalculate.userErrors.map(
    (error) => error.message,
  );
  const calculated = data.draftOrderCalculate.calculatedDraftOrder;
  const warnings = (calculated?.warnings ?? []).map((warning) => warning.message);
  const alerts = (calculated?.alerts ?? []).map(
    (alert) => `${alert.severity}: ${alert.title} — ${alert.content}`,
  );

  return {
    method: "admin_draft_order_calculate",
    label: "Admin draftOrderCalculate",
    requiresCart: false,
    ok: userErrors.length === 0 && Boolean(calculated),
    errors: userErrors,
    warnings: [...warnings, ...alerts],
    details: {
      shippingRateCount: calculated?.availableShippingRates.length ?? 0,
      shippingRates: calculated?.availableShippingRates ?? [],
    },
  };
}

export async function validateAddressViaDraftOrderValidationSummary(
  shipping: CheckoutShippingInput,
): Promise<AddressValidationMethodResult> {
  const createMutation = `#graphql
    mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          shippingAddress {
            validationResultSummary
            formatted(withName: true, withCompany: false)
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const createData = await adminGraphql<{
    draftOrderCreate: {
      draftOrder: {
        id: string;
        shippingAddress: {
          validationResultSummary: string | null;
          formatted: string[];
        } | null;
      } | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(
    createMutation,
    { input: probeDraftOrderInput(shipping) },
    { operation: "addressValidationDraftOrderCreate" },
  );

  const createErrors = createData.draftOrderCreate.userErrors.map(
    (error) => error.message,
  );
  const draftOrder = createData.draftOrderCreate.draftOrder;

  if (createErrors.length || !draftOrder) {
    return {
      method: "admin_draft_order_validation_summary",
      label: "Admin draft order validationResultSummary",
      requiresCart: false,
      ok: false,
      errors: createErrors.length
        ? createErrors
        : ["Failed to create probe draft order"],
      warnings: [],
      details: {},
    };
  }

  const validationResultSummary =
    draftOrder.shippingAddress?.validationResultSummary ?? null;

  try {
    const deleteMutation = `#graphql
      mutation DraftOrderDelete($input: DraftOrderDeleteInput!) {
        draftOrderDelete(input: $input) {
          deletedId
          userErrors {
            message
          }
        }
      }
    `;

    await adminGraphql<{
      draftOrderDelete: {
        deletedId: string | null;
        userErrors: Array<{ message: string }>;
      };
    }>(
      deleteMutation,
      { input: { id: draftOrder.id } },
      { operation: "addressValidationDraftOrderDelete" },
    );
  } catch {
    // Probe draft may remain if delete fails; validation result is still useful.
  }

  const ok =
    validationResultSummary === "NO_ISSUES" || validationResultSummary === null;

  const warnings =
    validationResultSummary === "WARNING"
      ? ["Shopify reported WARNING on this address."]
      : [];

  const errors =
    validationResultSummary === "ERROR"
      ? ["Shopify reported ERROR on this address (likely undeliverable)."]
      : [];

  return {
    method: "admin_draft_order_validation_summary",
    label: "Admin draft order validationResultSummary",
    requiresCart: false,
    ok: ok && errors.length === 0,
    errors,
    warnings,
    details: {
      validationResultSummary,
      formattedAddress: draftOrder.shippingAddress?.formatted ?? [],
      note:
        validationResultSummary === null
          ? "null means Shopify has not run deliverability validation yet."
          : undefined,
    },
  };
}

export async function runAddressValidationComparison(
  shipping: CheckoutShippingInput,
  options?: { includeCartMethod?: boolean },
): Promise<AddressValidationMethodResult[]> {
  const includeCartMethod = options?.includeCartMethod ?? true;
  const adminResults = await Promise.all([
    validateAddressViaDraftOrderCalculate(shipping),
    validateAddressViaDraftOrderValidationSummary(shipping),
  ]);

  if (!includeCartMethod) {
    return adminResults;
  }

  const cartResult = await validateAddressViaStorefrontCartStrict(shipping);
  return [cartResult, ...adminResults];
}
