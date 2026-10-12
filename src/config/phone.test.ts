import { describe, expect, it } from "vitest";
import { isValidPhone, normalizePhone } from "@/config/phone";

describe("phone numbers", () => {
  it("normalizes local and spaced numbers to international format", () => {
    expect(normalizePhone("077 000 0300", "lr")).toBe("+231770000300");
    expect(normalizePhone("+231 77-000-0300", "lr")).toBe("+231770000300");
    expect(normalizePhone("00231770000300", "lr")).toBe("+231770000300");
  });

  it("validates against the country's format", () => {
    expect(isValidPhone("+231770000300", "lr")).toBe(true);
    expect(isValidPhone("+23177", "lr")).toBe(false);
    expect(isValidPhone("+233240000000", "lr")).toBe(false);
  });
});
