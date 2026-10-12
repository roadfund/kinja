import { describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimit } from "@/auth/rate-limit";

const rule = { limit: 2, windowMs: 60_000 };

describe("consumeRateLimit", () => {
  it("blocks attempts over the limit until the window resets", () => {
    const now = 1_000_000;
    expect(consumeRateLimit("test:a", rule, now).allowed).toBe(true);
    expect(consumeRateLimit("test:a", rule, now + 1).allowed).toBe(true);
    const blocked = consumeRateLimit("test:a", rule, now + 2);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(consumeRateLimit("test:a", rule, now + 60_001).allowed).toBe(true);
  });

  it("keeps keys separate and can be reset", () => {
    consumeRateLimit("test:b", rule);
    consumeRateLimit("test:b", rule);
    expect(consumeRateLimit("test:c", rule).allowed).toBe(true);
    resetRateLimit("test:b");
    expect(consumeRateLimit("test:b", rule).allowed).toBe(true);
  });
});
