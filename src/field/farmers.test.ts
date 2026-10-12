import { beforeEach, describe, expect, it } from "vitest";
import { recordDelivery } from "@/field/deliveries";
import { findFarmersWithPhone, getFarmer, listFarmers, registerFarmer, updateFarmer } from "@/field/farmers";
import { useMemoryRepository } from "@/test/memory-repository";

const input = {
  fullName: "Mariama Kromah", gender: "FEMALE", age: 42, community: "Gbarnga", phone: "+231770000000",
  topCrops: [{ crop: "Cassava", status: "ALREADY_GROWS" }],
  plots: [{ description: "River plot", village: "Gbarnga", size: 2.5, unit: "ACRES", tenure: "OWNED", crops: ["Cassava"], gps: "6.998000, -9.472000" }],
  incomeSource: "Farming only",
};

describe("registerFarmer", () => {
  beforeEach(() => { useMemoryRepository(); });

  it("stores the farmer in the caller's hub and cooperative", async () => {
    const farmer = await registerFarmer(input, { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" });
    expect(farmer.createdById).toBe("user-1");
    expect(await listFarmers("hub-a", "coop-a")).toEqual([farmer]);
    expect(await listFarmers("hub-b", "coop-a")).toEqual([]);
    expect(await listFarmers("hub-a", "coop-b")).toEqual([]);
  });

  it("rejects duplicate crop ranks, missing plots and unnamed other crops", async () => {
    const scope = { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" };
    await expect(registerFarmer({ ...input, topCrops: [input.topCrops[0], input.topCrops[0]] }, scope)).rejects.toThrow();
    await expect(registerFarmer({ ...input, plots: [] }, scope)).rejects.toThrow();
    await expect(registerFarmer({ ...input, plots: [{ ...input.plots[0], crops: ["Other"] }] }, scope)).rejects.toThrow();
    await expect(registerFarmer({ ...input, photoUrl: "https://example.com/photo.jpg" }, scope)).rejects.toThrow();
  });

  it("hides farmers from other hubs and cooperatives", async () => {
    const farmer = await registerFarmer(input, { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" });
    expect(await getFarmer(farmer.id, { hubId: "hub-a", cooperativeId: "coop-a" })).toEqual(farmer);
    expect(await getFarmer(farmer.id, { hubId: "hub-b", cooperativeId: "coop-a" })).toBeNull();
    expect(await getFarmer(farmer.id, { hubId: "hub-a", cooperativeId: "coop-b" })).toBeNull();
    await expect(updateFarmer(farmer.id, input, { hubId: "hub-a", cooperativeId: "coop-b", userId: "user-2" })).rejects.toThrow("not found");
  });
});

describe("updateFarmer", () => {
  const scope = { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" };

  beforeEach(() => { useMemoryRepository(); });

  it("updates details, keeps plot ids and audit fields, and adds new plots", async () => {
    const farmer = await registerFarmer(input, scope, new Date("2026-01-01T00:00:00.000Z"));
    const plotId = farmer.plots[0].id;
    const updated = await updateFarmer(farmer.id, { ...input, community: "Salala", plots: [{ ...input.plots[0], id: plotId, size: 3 }, { ...input.plots[0], description: "Swamp plot" }] }, { ...scope, userId: "user-2" }, new Date("2026-02-01T00:00:00.000Z"));
    expect(updated).toMatchObject({ community: "Salala", createdById: "user-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" });
    expect(updated.plots[0]).toMatchObject({ id: plotId, size: 3 });
    expect(updated.plots[1].id).toBeTruthy();
    expect(updated.plots[1].id).not.toBe(plotId);
  });

  it("refuses to remove a plot that has deliveries", async () => {
    const repository = useMemoryRepository();
    await repository.put("HubCrop", { id: "hc", hubId: "hub-a", cropId: "cassava", enabled: true, grades: [{ gradeId: "a", name: "A", priceMinorPerKg: 100, currency: "LRD" }], createdById: "s", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    const farmer = await registerFarmer(input, scope);
    await recordDelivery({ farmerId: farmer.id, plotId: farmer.plots[0].id, cropId: "cassava", gradeId: "a", kilograms: "5" }, scope);
    await expect(updateFarmer(farmer.id, { ...input, plots: [{ ...input.plots[0], description: "Replacement" }] }, scope)).rejects.toThrow("cannot be removed");
  });
});

describe("farmer phone numbers", () => {
  const scope = { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" };

  beforeEach(() => { useMemoryRepository(); });

  it("allows no phone, normalizes local numbers, and rejects invalid ones", async () => {
    const withoutPhone = await registerFarmer({ ...input, phone: undefined }, scope);
    expect(withoutPhone.phone).toBeUndefined();
    const local = await registerFarmer({ ...input, phone: "077 000 0300", mobileMoneyNumber: "0880000300" }, scope);
    expect(local).toMatchObject({ phone: "+231770000300", mobileMoneyNumber: "+231880000300" });
    await expect(registerFarmer({ ...input, phone: "12345" }, scope)).rejects.toThrow("not a valid number");
    await expect(registerFarmer({ ...input, mobileMoneyNumber: "+23312" }, scope)).rejects.toThrow("Mobile money number");
  });

  it("finds other farmers with the same phone in the hub, naming only those in the same cooperative", async () => {
    const first = await registerFarmer(input, scope);
    await registerFarmer({ ...input, fullName: "Other Coop Farmer" }, { ...scope, cooperativeId: "coop-b" });
    const matches = await findFarmersWithPhone("hub-a", "coop-a", "0770000000");
    expect(matches.map((match) => [match.fullName, match.sameCooperative])).toEqual([["Mariama Kromah", true], ["A farmer in another cooperative", false]]);
    expect(await findFarmersWithPhone("hub-a", "coop-a", "+231770000000", first.id)).toHaveLength(1);
    expect(await findFarmersWithPhone("hub-b", "coop-a", "+231770000000")).toEqual([]);
  });

  it("keeps device-generated ids for the farmer and plots", async () => {
    const id = "01a10c00-0000-7000-8000-000000000001";
    const plotId = "01a10c00-0000-7000-8000-000000000002";
    const farmer = await registerFarmer({ ...input, plots: [{ ...input.plots[0], id: plotId }] }, scope, new Date(), { id });
    expect(farmer.id).toBe(id);
    expect(farmer.plots[0].id).toBe(plotId);
    await expect(registerFarmer(input, scope, new Date(), { id: "not-a-uuid" })).rejects.toThrow("Invalid record id");
  });
});
