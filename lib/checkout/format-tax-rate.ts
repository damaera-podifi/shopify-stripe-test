export function formatTaxRate(rate: number | null | undefined): string | null {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  const percent = rate * 100;
  const formatted =
    percent >= 1
      ? percent.toFixed(2).replace(/\.?0+$/, "")
      : percent.toFixed(3).replace(/\.?0+$/, "");

  return `${formatted}%`;
}

export function formatTaxLineLabel(
  title: string,
  rate?: number | null,
): string {
  const rateLabel = formatTaxRate(rate);
  return rateLabel ? `${title} (${rateLabel})` : title;
}
