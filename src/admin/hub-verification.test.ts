import { describe, expect, it } from "vitest";
import { reviewHub } from "@/admin/hub-verification";
import type { Hub } from "@/domain/model";

const hub: Hub = {
  id: "hub-1", countryId: "lr", businessName: "Kinja Foods", status: "PENDING_VERIFICATION", regionOrCounty: "Montserrado", physicalAddress: "Monrovia", businessCategory: "cooperative union", yearEstablished: 2020, businessRegistrationNumber: "REG-1", registrationCertificateUrl: "certificate.pdf", contactPerson: { fullName: "Amina Doe", title: "Director", phone: "+231000000", email: "amina@example.com" }, mainCropIds: ["cassava"], approximateFarmerCount: 10, approximateCooperativeCount: 1, createdById: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("reviewHub", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("lets a tech admin approve a pending hub and records the review", () => {
    const result = reviewHub(hub, { actorId: "tech-1", actorRole: "TECH_ADMIN", decision: "VERIFIED", now });
    expect(result.hub.status).toBe("VERIFIED");
    expect(result.verification.reviewedById).toBe("tech-1");
  });

  it("requires a reason for rejection", () => {
    expect(() => reviewHub(hub, { actorId: "tech-1", actorRole: "TECH_ADMIN", decision: "REJECTED", now })).toThrow("rejection reason");
  });

  it("rejects non-tech admins and already reviewed hubs", () => {
    expect(() => reviewHub(hub, { actorId: "hub-admin", actorRole: "HUB_ADMIN", decision: "VERIFIED", now })).toThrow("Only tech admins");
    expect(() => reviewHub({ ...hub, status: "VERIFIED" }, { actorId: "tech-1", actorRole: "TECH_ADMIN", decision: "VERIFIED", now })).toThrow("Only pending hubs");
  });
});