import { describe, expect, it } from "vitest";
import { convertMinor, formatDual, moneyLines, parseRate, rateAt, totalIn, type MoneyContext } from "@/domain/currency";

// Intl puts a non-breaking space after the currency code.
const plain = (text: string) => text.replace(/\s/g, " ");

const context: MoneyContext = { primary: "LRD", currencies: ["LRD", "USD"], rates: [
  { currency: "USD", rateTenThousandths: 1_800_000, effectiveFrom: "2026-01-01T00:00:00.000Z" },
  { currency: "USD", rateTenThousandths: 2_000_000, effectiveFrom: "2026-06-01T00:00:00.000Z" },
] };

describe("currencies", () => {
  it("parses rates without floats", () => {
    expect(parseRate("190.5")).toBe(1_905_000);
    expect(parseRate("0")).toBeNull();
    expect(parseRate("1.23456")).toBeNull();
  });

  it("converts each amount at the rate in force on its own date", () => {
    expect(rateAt(context, "USD", "2026-03-01T00:00:00.000Z")).toBe(1_800_000);
    expect(rateAt(context, "USD")).toBe(2_000_000);
    expect(convertMinor(context, { minor: 1000, currency: "USD", at: "2026-03-01T00:00:00.000Z" }, "LRD")).toBe(180_000);
    expect(convertMinor(context, { minor: 200_000, currency: "LRD", at: "2026-07-01T00:00:00.000Z" }, "USD")).toBe(1000);
    // Records older than the first rate use the first rate.
    expect(convertMinor(context, { minor: 100, currency: "USD", at: "2025-01-01T00:00:00.000Z" }, "LRD")).toBe(18_000);
    expect(totalIn(context, [{ minor: 100, currency: "USD", at: "2026-07-01T00:00:00.000Z" }, { minor: 5_000, currency: "LRD" }], "LRD")).toBe(25_000);
  });

  it("shows the recorded currency first, then the others", () => {
    expect(moneyLines(context, { minor: 100, currency: "USD", at: "2026-07-01T00:00:00.000Z" }).map((line) => plain(line.text))).toEqual(["USD 1.00", "LRD 200.00"]);
    expect(plain(formatDual(context, { minor: 20_000, currency: "LRD" }))).toBe("LRD 200.00 (USD 1.00)");
    expect(moneyLines({ ...context, rates: [] }, { minor: 100, currency: "LRD" })[1].text).toBe("USD —");
  });
});
