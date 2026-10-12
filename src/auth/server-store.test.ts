import { describe, expect, it } from "vitest";
import { dashboardPath } from "@/auth/server-store";

describe("dashboardPath", () => {
  it("routes a pending hub admin to verification", () => expect(dashboardPath({ user: {} as never, membership: { role: "HUB_ADMIN" } as never, hub: { status: "PENDING_VERIFICATION" } as never })).toBe("/auth/pending"));
  it("routes verified and operational roles to their dashboards", () => {
    expect(dashboardPath({ user: {} as never, membership: { role: "HUB_ADMIN" } as never, hub: { status: "VERIFIED" } as never })).toBe("/dashboard/hub");
    expect(dashboardPath({ user: {} as never, membership: { role: "COOP_LEAD" } as never })).toBe("/dashboard/cooperative");
    expect(dashboardPath({ user: {} as never, membership: { role: "MANUFACTURER" } as never })).toBe("/dashboard/manufacturer");
    expect(dashboardPath({ user: {} as never, membership: { role: "DISTRIBUTOR" } as never })).toBe("/dashboard/distributor");
  });
});