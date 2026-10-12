import { describe, expect, it } from "vitest";
import { requireCooperativeScope, requireRole } from "@/auth/authorization";
import type { Hub, Membership, Organization } from "@/domain/model";

const audit = { createdById: "system", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const hub: Hub = { id: "hub-a", countryId: "lr", businessName: "Hub A", status: "VERIFIED", regionOrCounty: "Bong", physicalAddress: "Gbarnga", businessCategory: "Cooperative", yearEstablished: 2020, businessRegistrationNumber: "R-1", registrationCertificateUrl: "c.pdf", contactPerson: { fullName: "A", title: "B", phone: "1", email: "a@example.com" }, mainCropIds: [], approximateFarmerCount: 0, approximateCooperativeCount: 0, ...audit };
const coop: Organization = { id: "coop-a", hubId: "hub-a", name: "Coop A", type: "COOPERATIVE", ...audit };
const member = (role: Membership["role"], changes: Partial<Membership> = {}): Membership => ({ id: "m-1", userId: "user-1", hubId: "hub-a", role, status: "ACTIVE", ...audit, ...changes });
const user = { id: "user-1" };

describe("requireRole", () => {
  it("returns the caller's scope for an allowed role in their own hub", () => {
    expect(requireRole({ user, membership: member("HUB_ADMIN"), hub }, ["HUB_ADMIN"])).toEqual({ userId: "user-1", hubId: "hub-a", organizationId: undefined, role: "HUB_ADMIN" });
  });

  it("rejects missing, inactive and wrong-role memberships", () => {
    expect(() => requireRole({ user, hub }, ["HUB_ADMIN"])).toThrow("Sign in");
    expect(() => requireRole({ user, membership: member("HUB_ADMIN", { status: "REMOVED" }), hub }, ["HUB_ADMIN"])).toThrow("not active");
    expect(() => requireRole({ user, membership: member("DISTRIBUTOR"), hub }, ["HUB_ADMIN"])).toThrow("permission");
  });

  it("isolates hubs", () => {
    expect(() => requireRole({ user, membership: member("HUB_ADMIN", { hubId: "hub-b" }), hub }, ["HUB_ADMIN"])).toThrow("Hub access denied");
    expect(() => requireRole({ user, membership: member("HUB_ADMIN") }, ["HUB_ADMIN"])).toThrow("Hub access denied");
  });

  it("blocks suspended and rejected hubs", () => {
    expect(() => requireRole({ user, membership: member("HUB_ADMIN"), hub: { ...hub, status: "SUSPENDED" } }, ["HUB_ADMIN"])).toThrow("not available");
    expect(() => requireRole({ user, membership: member("HUB_ADMIN"), hub: { ...hub, status: "REJECTED" } }, ["HUB_ADMIN"])).toThrow("not available");
  });

  it("lets only hub admins work in a pending hub, and never where verification is required", () => {
    const pending = { ...hub, status: "PENDING_VERIFICATION" as const };
    expect(() => requireRole({ user, membership: member("HUB_ADMIN"), hub: pending }, ["HUB_ADMIN"])).not.toThrow();
    expect(() => requireRole({ user, membership: member("HUB_ADMIN"), hub: pending }, ["HUB_ADMIN"], { verifiedHub: true })).toThrow("verified");
    expect(() => requireRole({ user, membership: member("COOP_LEAD", { organizationId: "coop-a" }), hub: pending }, ["COOP_LEAD"])).toThrow("verified");
  });

  it("does not need a hub for the tech admin", () => {
    expect(requireRole({ user, membership: member("TECH_ADMIN", { hubId: "platform" }) }, ["TECH_ADMIN"]).role).toBe("TECH_ADMIN");
  });
});

describe("requireCooperativeScope", () => {
  it("requires membership of a cooperative in the same hub", () => {
    expect(requireCooperativeScope({ user, membership: member("FIELD_STAFF", { organizationId: "coop-a" }), hub, organization: coop }).organizationId).toBe("coop-a");
    expect(() => requireCooperativeScope({ user, membership: member("FIELD_STAFF"), hub })).toThrow("cooperative");
    expect(() => requireCooperativeScope({ user, membership: member("COOP_LEAD", { organizationId: "coop-a" }), hub, organization: { ...coop, type: "MANUFACTURER" } })).toThrow("cooperative");
    expect(() => requireCooperativeScope({ user, membership: member("COOP_LEAD", { organizationId: "coop-a" }), hub, organization: { ...coop, hubId: "hub-b" } })).toThrow("cooperative");
  });
});
