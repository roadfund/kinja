// Money is always stored as integer minor units (e.g. cents). Weights are stored
// as decimal strings with up to 3 places, so we convert to grams to stay exact.
export function kilogramsToGrams(kilograms: string): number {
  const [whole, fraction = ""] = kilograms.split(".");
  return Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
}

export function amountForWeight(kilograms: string, priceMinorPerKg: number): number {
  return Math.round((kilogramsToGrams(kilograms) * priceMinorPerKg) / 1000);
}

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code" }).format(minor / 100);
}

export function formatKilograms(grams: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(grams / 1000)} kg`;
}

// Quantities (kg or units) share the same exact representation: thousandths.
export const toThousandths = kilogramsToGrams;

export function fromThousandths(thousandths: number): string {
  const whole = Math.floor(thousandths / 1000);
  const fraction = String(thousandths % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function formatQuantity(thousandths: number, unit: "KG" | "UNIT"): string {
  const value = new Intl.NumberFormat("en", { maximumFractionDigits: unit === "KG" ? 1 : 3 }).format(thousandths / 1000);
  return unit === "KG" ? `${value} kg` : `${value} ${thousandths === 1000 ? "unit" : "units"}`;
}

// "150.5" typed in a form becomes 15050 minor units, without float rounding.
export function toMinor(amount: string): number {
  const [whole, fraction = ""] = amount.trim().split(".");
  return Number(whole || "0") * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
}

export function minorToInput(minor: number): string {
  return (minor / 100).toFixed(2);
}
