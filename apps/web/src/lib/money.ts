// Formats integer pence as a currency string (client-safe: no server imports).
export function formatMoney(pence: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(pence / 100);
}
