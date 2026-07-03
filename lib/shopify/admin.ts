import { logCheckout, logCheckoutError } from "@/lib/checkout/logger";
import { getAdminAccessToken } from "./access-token";
import { getShopifyStoreDomain, SHOPIFY_API_VERSION } from "./config";

type AdminGraphqlError = {
  message: string;
  extensions?: Record<string, unknown>;
};

type AdminResponse<T> = {
  data?: T;
  errors?: AdminGraphqlError[];
};

type AdminGraphqlOptions = {
  operation?: string;
  // GraphQL error codes the caller already handles. When every returned error
  // matches one of these, the failure is logged at info level instead of error
  // so expected scope/permission gaps do not pollute the error stream.
  expectedErrorCodes?: string[];
};

function allErrorsExpected(
  errors: AdminGraphqlError[],
  expectedCodes: string[],
): boolean {
  if (expectedCodes.length === 0) return false;
  const allowed = new Set(expectedCodes);
  return errors.every((error) => {
    const code = error.extensions?.code;
    return typeof code === "string" && allowed.has(code);
  });
}

export async function adminGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: AdminGraphqlOptions,
): Promise<T> {
  const operation = options?.operation ?? "graphql";
  const domain = getShopifyStoreDomain();

  logCheckout("admin_graphql_start", { operation, domain });

  let token: string;
  try {
    token = await getAdminAccessToken();
  } catch (error) {
    logCheckoutError("admin_token_failed", error, { operation });
    throw error;
  }

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

  const rawBody = await response.text();

  if (!response.ok) {
    logCheckoutError("admin_graphql_http_error", new Error("HTTP error"), {
      operation,
      status: response.status,
      body: rawBody.slice(0, 500),
    });
    throw new Error(`Admin API request failed (${response.status})`);
  }

  let json: AdminResponse<T>;
  try {
    json = JSON.parse(rawBody) as AdminResponse<T>;
  } catch (error) {
    logCheckoutError("admin_graphql_parse_error", error, {
      operation,
      body: rawBody.slice(0, 500),
    });
    throw new Error("Admin API returned invalid JSON");
  }

  if (json.errors?.length) {
    const expectedCodes = options?.expectedErrorCodes ?? [];
    if (allErrorsExpected(json.errors, expectedCodes)) {
      logCheckout("admin_graphql_expected_error", {
        operation,
        errors: json.errors,
      });
    } else {
      logCheckoutError("admin_graphql_errors", new Error("GraphQL errors"), {
        operation,
        errors: json.errors,
      });
    }
    throw new Error(json.errors.map((e) => e.message).join(", "));
  }

  if (!json.data) {
    logCheckoutError("admin_graphql_no_data", new Error("No data"), {
      operation,
      body: rawBody.slice(0, 500),
    });
    throw new Error("Admin API returned no data");
  }

  logCheckout("admin_graphql_ok", { operation });
  return json.data;
}
