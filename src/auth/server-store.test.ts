import { describe, expect, it } from "vitest";
import { authenticate, consumePendingSignup, dashboardPath, savePendingSignup } from "@/auth/server-store";
import { useMemoryRepository } from "@/test/memory-repository";

describe("dashboardPath", () => {
  it("routes a pending hub admin to verification", () => expect(dashboardPath({ user: {} as never, membership: { role: "HUB_ADMIN" } as never, hub: { status: "PENDING_VERIFICATION" } as never })).toBe("/auth/pending"));
  it("routes verified and operational roles to their dashboards", () => {
    expect(dashboardPath({ user: {} as never, membership: { role: "HUB_ADMIN" } as never, hub: { status: "VERIFIED" } as never })).toBe("/dashboard/hub");
    expect(dashboardPath({ user: {} as never, membership: { role: "COOP_LEAD" } as never })).toBe("/dashboard/cooperative");
    expect(dashboardPath({ user: {} as never, membership: { role: "MANUFACTURER" } as never })).toBe("/dashboard/manufacturer");
    expect(dashboardPath({ user: {} as never, membership: { role: "DISTRIBUTOR" } as never })).toBe("/dashboard/distributor");
  });
});
describe("tech admin first sign-in", () => {
  it("creates the tech admin from the environment, with no phone, and signs them in", async () => {
    useMemoryRepository();
    process.env.TECH_ADMIN_USERNAME = "platform-admin";
    process.env.TECH_ADMIN_PASSWORD = "a-long-test-password";
    try {
      const result = await authenticate("platform-admin", "a-long-test-password");
      expect(result?.account.membership?.role).toBe("TECH_ADMIN");
      expect(result?.account.user.phone).toBeUndefined();
      expect(await authenticate("platform-admin", "wrong-password")).toBeNull();
    } finally {
      delete process.env.TECH_ADMIN_USERNAME;
      delete process.env.TECH_ADMIN_PASSWORD;
    }
  });
});

describe("pending signups", () => {
  const signup = { fullName: "Jimmy Kpadeh", username: "jimmy", phone: "+231770000001", passwordHash: "salt.hash", passwordSalt: "salt" };

  it("keeps the signup in the database until onboarding uses it, once", async () => {
    const repository = useMemoryRepository();
    const token = await savePendingSignup(signup);
    expect(await repository.list("PendingSignup")).toHaveLength(1);
    expect((await repository.list("PendingSignup"))[0].tokenHash).not.toBe(token);
    expect(await consumePendingSignup(token)).toMatchObject({ username: "jimmy", fullName: "Jimmy Kpadeh" });
    expect(await consumePendingSignup(token)).toBeNull();
  });

  it("expires after an hour", async () => {
    useMemoryRepository();
    const token = await savePendingSignup(signup, new Date("2026-10-12T10:00:00.000Z"));
    expect(await consumePendingSignup(token, new Date("2026-10-12T11:00:01.000Z"))).toBeNull();
  });
});
