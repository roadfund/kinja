import { beforeEach, describe, expect, it } from "vitest";
import { listDeliveries, recordDelivery } from "@/field/deliveries";
import { registerFarmer } from "@/field/farmers";
import type { Farmer, HubCrop } from "@/domain/model";
import { useMemoryRepository } from "@/test/memory-repository";

const scope = { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" };
const audit = { createdById: "system", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const hubCrop: HubCrop = { id: "hc-1", hubId: "hub-a", cropId: "cassava", enabled: true, grades: [{ gradeId: "a", name: "Grade A", priceMinorPerKg: 650, currency: "LRD" }, { gradeId: "rejected", name: "Rejected", priceMinorPerKg: 0, currency: "LRD" }], ...audit };

describe("recordDelivery", () => {
  let farmer: Farmer;

  beforeEach(async () => {
    const repository = useMemoryRepository();
    await repository.put("HubCrop", hubCrop);
    farmer = await registerFarmer({ fullName: "Mariama Kromah", gender: "FEMALE", age: 42, community: "Gbarnga", phone: "+231770000000", topCrops: [{ crop: "Cassava", status: "ALREADY_GROWS" }], plots: [{ description: "River plot", village: "Gbarnga", size: 2, unit: "ACRES", tenure: "OWNED", crops: ["Cassava"] }], incomeSource: "Farming only" }, scope);
  });

  it("snapshots the hub price and computes the amount owed", async () => {
    const delivery = await recordDelivery({ farmerId: farmer.id, plotId: farmer.plots[0].id, cropId: "cassava", gradeId: "a", kilograms: "25.5" }, scope);
    expect(delivery).toMatchObject({ priceMinorPerKg: 650, amountOwedMinor: 16575, cooperativeId: "coop-a" });
    expect(await listDeliveries("hub-a", "coop-a")).toEqual([delivery]);
  });

  it("rejects farmers from other cooperatives or hubs", async () => {
    await expect(recordDelivery({ farmerId: farmer.id, cropId: "cassava", gradeId: "a", kilograms: "1" }, { ...scope, cooperativeId: "coop-b" })).rejects.toThrow("not part of your cooperative");
    await expect(recordDelivery({ farmerId: farmer.id, cropId: "cassava", gradeId: "a", kilograms: "1" }, { ...scope, hubId: "hub-b" })).rejects.toThrow("not part of your cooperative");
  });

  it("rejects unknown grades, zero weights and rejected produce without a reason", async () => {
    await expect(recordDelivery({ farmerId: farmer.id, cropId: "cassava", gradeId: "z", kilograms: "1" }, scope)).rejects.toThrow("not enabled");
    await expect(recordDelivery({ farmerId: farmer.id, cropId: "cassava", gradeId: "a", kilograms: "0" }, scope)).rejects.toThrow();
    await expect(recordDelivery({ farmerId: farmer.id, cropId: "cassava", gradeId: "rejected", kilograms: "3" }, scope)).rejects.toThrow("reason");
  });
});
