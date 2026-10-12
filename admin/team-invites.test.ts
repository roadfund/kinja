import { describe, expect, it } from "vitest";
import { createInvite } from "@/admin/team-invites";
import type { Hub } from "@/domain/model";

const hub: Hub = { id: "hub-1", countryId: "lr", businessName: "Kinja Foods", status: "VERIFIED", regionOrCounty: "Montserrado", physicalAddress: "Monrovia", businessCategory: "Cooperative", yearEstablished: 2020, businessRegistrationNumber: "REG-1", registrationCertificateUrl: "certificate.pdf", contactPerson: { fullName: "Amina Doe", title: "Director", phone: "+231000000", email: "amina@example.com" }, mainCropIds: [], approximateFarmerCount: 10, approximateCooperativeCount: 1, createdById: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

describe("createInvite", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  const expiresAt = "2026-06-08T00:00:00.000Z";

  it("creates a verified hub invite with a shareable code", () => {
    const invite = createInvite(hub, { actorId: "admin-1", actorRole: "HUB_ADMIN", role: "COOP_LEAD", organizationId: "coop-1", maxUses: 1, expiresAt, now });
    expect(invite.code).toHaveLength(12);
    expect(invite.uses).toBe(0);
  });

  it("enforces role scope and verification status", () => {
    expect(() => createInvite(hub, { actorId: "coop-1", actorRole: "COOP_LEAD", role: "MANUFACTURER", maxUses: 1, expiresAt, now })).toThrow("only invite field staff");
    expect(() => createInvite({ ...hub, status: "PENDING_VERIFICATION" }, { actorId: "admin-1", actorRole: "HUB_ADMIN", role: "COOP_LEAD", maxUses: 1, expiresAt, now })).toThrow("verified");
  });
});