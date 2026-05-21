export function injectBuyerInContext(
  query: string,
  customerAccessToken: string,
): string {
  const escaped = customerAccessToken.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const directive = `@inContext(buyer: { customerAccessToken: "${escaped}" })`;

  if (query.includes("@inContext(buyer:")) return query;

  return query.replace(
    /^(\s*query\s+[\w]+\s*(?:\([^)]*\))?)\s*\{/m,
    `$1 ${directive} {`,
  );
}
