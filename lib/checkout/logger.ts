const PREFIX = "[shopify-checkout]";

function formatData(data?: Record<string, unknown>) {
  if (!data || Object.keys(data).length === 0) return "";
  try {
    return ` ${JSON.stringify(data)}`;
  } catch {
    return ` ${String(data)}`;
  }
}

export function logCheckout(
  step: string,
  data?: Record<string, unknown>,
): void {
  console.log(`${PREFIX} ${step}${formatData(data)}`);
}

export function logCheckoutError(
  step: string,
  error: unknown,
  data?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    `${PREFIX} ${step}${formatData({
      ...data,
      message: err.message,
      name: err.name,
      stack: err.stack,
    })}`,
  );
}
