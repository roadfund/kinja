import { describe, expect, it } from "vitest";
import { updateHubCropPrice } from "@/admin/hub-crops";
import type { Hub, HubCrop } from "@/domain/model";

const hub: Hub = { id: "hub-1", countryId: "lr", businessName: "Kinja Foods", status: "PENDING_VERIFICATION", regionOrCounty: "Montserrado", physicalAddress: "Monrovia", businessCategory: "Cooperative", yearEstablished: 2020, businessRegistrationNumber: "REG-1", registrationCertificateUrl: "certificate.pdf", contactPerson: { fullName: "Amina Doe", title: "Director", phone: "+231000000", email: "amina@example.com" }, mainCropIds: [], approximateFarmerCount: 10, approximateCooperativeCount: 1, createdById: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const hubCrop: HubCrop = { id: "hub-crop-1", hubId: "hub-1", cropId: "cassava", enabled: true, grades: [{ gradeId: "a", name: "Grade A", priceMinorPerKg: 500, currency: "LRD" }], createdById: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

describe("updateHubCropPrice", () => {
  it("updates a grade price in integer minor units while a hub is pending", () => expect(updateHubCropPrice(hub, hubCrop, { actorRole: "HUB_ADMIN", gradeId: "a", priceMinorPerKg: 650 }).grades[0].priceMinorPerKg).toBe(650));
  it("rejects floats, wrong roles, and disabled hubs", () => {
    expect(() => updateHubCropPrice(hub, hubCrop, { actorRole: "HUB_ADMIN", gradeId: "a", priceMinorPerKg: 6.5 })).toThrow("minor units");
    expect(() => updateHubCropPrice(hub, hubCrop, { actorRole: "COOP_LEAD", gradeId: "a", priceMinorPerKg: 650 })).toThrow("hub admins");
    expect(() => updateHubCropPrice({ ...hub, status: "SUSPENDED" }, hubCrop, { actorRole: "HUB_ADMIN", gradeId: "a", priceMinorPerKg: 650 })).toThrow("cannot be configured");
  });
});