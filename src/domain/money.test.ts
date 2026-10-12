import { describe, expect, it } from "vitest";
import { amountForWeight, formatMoney, kilogramsToGrams } from "@/domain/money";

describe("money and weights", () => {
  it("converts decimal kilograms to whole grams without float error", () => {
    expect(kilogramsToGrams("25.5")).toBe(25500);
    expect(kilogramsToGrams("0.125")).toBe(125);
    expect(kilogramsToGrams("12")).toBe(12000);
  });

  it("computes the amount owed in integer minor units", () => {
    expect(amountForWeight("25.5", 650)).toBe(16575);
    expect(amountForWeight("0.001", 650)).toBe(1);
    expect(Number.isInteger(amountForWeight("33.333", 777))).toBe(true);
  });

  it("formats minor units as currency", () => expect(formatMoney(16575, "LRD")).toMatch(/^LRD\s165\.75$/));
});
