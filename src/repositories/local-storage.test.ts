import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageRepository } from "@/repositories/local-storage";
import type { Hub } from "@/domain/model";
import { MemoryStorage } from "@/test/memory-repository";

const hub: Hub = {
  id: "hub-1",
  countryId: "lr",
  businessName: "Kinja Cooperative",
  status: "PENDING_VERIFICATION",
  regionOrCounty: "Montserrado",
  physicalAddress: "Monrovia",
  businessCategory: "cooperative union",
  yearEstablished: 2020,
  businessRegistrationNumber: "REG-1",
  registrationCertificateUrl: "certificate.pdf",
  contactPerson: { fullName: "Amina Doe", title: "Director", phone: "+231000000", email: "amina@example.com" },
  mainCropIds: ["cassava"],
  approximateFarmerCount: 10,
  approximateCooperativeCount: 1,
  createdById: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("LocalStorageRepository", () => {
  let repository: LocalStorageRepository;

  beforeEach(() => { repository = new LocalStorageRepository(new MemoryStorage()); });

  it("round-trips validated entities and isolates hubs", async () => {
    await repository.put("Hub", hub);
    expect(await repository.get("Hub", hub.id, hub.id)).toEqual(hub);
    expect(await repository.list("Hub", "other-hub")).toEqual([]);
  });

  it("rejects invalid entities before storing them", async () => {
    await expect(repository.put("Hub", { ...hub, yearEstablished: 0 })).rejects.toThrow();
  });
});