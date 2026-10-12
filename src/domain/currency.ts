import { formatMoney } from "@/domain/money";

// Everything needed to show money in every currency of a hub's country. Plain data, so
// server pages can pass it to client forms.
export type RateEntry = { currency: string; rateTenThousandths: number; effectiveFrom: string };
export type MoneyContext = { primary: string; currencies: string[]; rates: RateEntry[] };
// One recorded amount: its currency and the date it was recorded (which picks the rate).
export type MoneyItem = { minor: number; currency: string; at?: string };

// Ten-thousandths, without floats: "190.5" -> 1_905_000.
export function parseRate(value: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{1,4}))?$/.exec(value.trim());
  if (!match) return null;
  const result = Number(match[1]) * 10_000 + Number((match[2] ?? "").padEnd(4, "0"));
  return result > 0 ? result : null;
}

export function formatRate(rateTenThousandths: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(rateTenThousandths / 10_000);
}

// The rate in force at a moment (or the latest one when no moment is given).
export function rateAt(context: MoneyContext, currency: string, at?: string): number | null {
  const candidates = context.rates.filter((rate) => rate.currency === currency && (!at || rate.effectiveFrom <= at)).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  // A record older than the first rate uses the first rate rather than nothing.
  return (candidates[0] ?? context.rates.filter((rate) => rate.currency === currency).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0])?.rateTenThousandths ?? null;
}

// Converts through the main currency, rounding to the nearest minor unit. BigInt keeps large sums exact.
export function convertMinor(context: MoneyContext, item: MoneyItem, to: string): number | null {
  if (item.currency === to) return item.minor;
  let primaryMinor = BigInt(item.minor);
  if (item.currency !== context.primary) {
    const rate = rateAt(context, item.currency, item.at);
    if (!rate) return null;
    primaryMinor = (BigInt(item.minor) * BigInt(rate) + BigInt(5_000)) / BigInt(10_000);
  }
  if (to === context.primary) return Number(primaryMinor);
  const rate = rateAt(context, to, item.at);
  if (!rate) return null;
  return Number((primaryMinor * BigInt(10_000) + BigInt(rate) / BigInt(2)) / BigInt(rate));
}

// The total of several amounts in one currency, each converted at its own date's rate.
export function totalIn(context: MoneyContext, items: MoneyItem[], currency: string): number | null {
  let sum = 0;
  for (const item of items) {
    const converted = convertMinor(context, item, currency);
    if (converted === null) return null;
    sum += converted;
  }
  return sum;
}

// One line per currency of the country, main currency first: "LRD 2,490.00", "USD 13.11".
export function moneyLines(context: MoneyContext, value: MoneyItem | MoneyItem[]): Array<{ currency: string; text: string; recorded: boolean }> {
  const items = Array.isArray(value) ? value : [value];
  const recorded = new Set(items.map((item) => item.currency));
  // A single recorded currency comes first; mixed totals follow the country's order.
  const ordered = [...new Set([...(recorded.size === 1 ? recorded : []), ...context.currencies, ...recorded])];
  return ordered.map((currency) => {
    const total = totalIn(context, items, currency);
    return { currency, text: total === null ? `${currency} —` : formatMoney(total, currency), recorded: recorded.has(currency) && recorded.size === 1 };
  });
}

// A total written out in one currency, e.g. "USD 13.11" (or "USD —" with no rate).
export function formatIn(context: MoneyContext, items: MoneyItem[], currency: string): string {
  const total = totalIn(context, items, currency);
  return total === null ? `${currency} —` : formatMoney(total, currency);
}

// For exports and emails: "LRD 2,490.00 (USD 13.11)".
export function formatDual(context: MoneyContext, value: MoneyItem | MoneyItem[]): string {
  const [first, ...rest] = moneyLines(context, value);
  return rest.length ? `${first.text} (${rest.map((line) => line.text).join(", ")})` : first.text;
}

// Helpers to turn records into money items.
export const moneyItem = (minor: number, currency: string, at?: string): MoneyItem => ({ minor, currency, at });
export const singleCurrencyContext = (currency: string): MoneyContext => ({ primary: currency, currencies: [currency], rates: [] });
