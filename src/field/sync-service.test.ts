import { beforeEach, describe, expect, it } from "vitest";
import type { Account } from "@/auth/server-store";
import { createUuidV7 } from "@/domain/id";
import { loadSeedData, seedIds } from "@/dev/seed";
import { listDeliveries } from "@/field/deliveries";
import { listFarmers } from "@/field/farmers";
import { applySyncBatch, buildOfflinePack } from "@/field/sync-service";
import { getRepository } from "@/repositories/server";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

const farmerPayload = (fullName: string, phone?: string) => ({ fullName, gender: "FEMALE", age: 31, community: "Salala", phone, topCrops: [{ crop: "Cassava", status: "ALREADY_GROWS" }], plots: [{ id: createUuidV7(), description: "Swamp plot", village: "Salala", size: 1.5, unit: "ACRES", tenure: "RENTED", crops: ["Cassava"] }], incomeSource: "Farming only" });

describe("offline sync", () => {
  let fieldStaff: Account;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
    fieldStaff = await seededAccount("fieldstaff");
  });

  it("creates a farmer and a delivery recorded offline, keeping device ids, times and prices", async () => {
    const farmerId = createUuidV7();
    const payload = farmerPayload("Korto Gbor", "0770009999");
    const deliveryId = createUuidV7();
    const recordedAt = "2026-09-01T08:30:00.000Z";
    const results = await applySyncBatch(fieldStaff, { items: [
      { opId: "op-1", kind: "CREATE_FARMER", recordId: farmerId, recordedAt, payload },
      { opId: "op-2", kind: "RECORD_DELIVERY", recordId: deliveryId, recordedAt, devicePriceMinorPerKg: 600, payload: { farmerId, plotId: payload.plots[0].id, cropId: "cassava", gradeId: "a", kilograms: "10" } },
    ] });
    expect(results.map((result) => result.status)).toEqual(["APPLIED", "APPLIED"]);
    const delivery = (await listDeliveries(seedIds.verifiedHub, seedIds.cooperative)).find((item) => item.id === deliveryId)!;
    expect(delivery).toMatchObject({ farmerId, createdAt: recordedAt, priceMinorPerKg: 600, amountOwedMinor: 6000 });
    expect((await getRepository().list("AuditLog")).some((entry) => entry.action === "DEVICE_PRICE")).toBe(true);
  });

  it("is idempotent: sending the same items again creates no duplicates", async () => {
    const farmerId = createUuidV7();
    const items = [{ opId: "op-1", kind: "CREATE_FARMER", recordId: farmerId, recordedAt: new Date().toISOString(), payload: farmerPayload("Korto Gbor") }];
    await applySyncBatch(fieldStaff, { items });
    const again = await applySyncBatch(fieldStaff, { items });
    expect(again[0].status).toBe("ALREADY_APPLIED");
    expect((await listFarmers(seedIds.verifiedHub, seedIds.cooperative)).filter((farmer) => farmer.id === farmerId)).toHaveLength(1);
  });

  it("flags likely duplicate farmers for review instead of merging", async () => {
    const results = await applySyncBatch(fieldStaff, { items: [{ opId: "op-1", kind: "CREATE_FARMER", recordId: createUuidV7(), recordedAt: new Date().toISOString(), payload: { ...farmerPayload("mariama  kromah"), community: "Gbarnga" } }] });
    expect(results[0].warnings?.[0]).toContain("may already be registered");
    const flagged = (await listFarmers(seedIds.verifiedHub, seedIds.cooperative)).find((farmer) => farmer.possibleDuplicateOf);
    expect(flagged?.fullName).toBe("mariama  kromah");
  });

  it("uses last write wins for edits and keeps every version in the audit log", async () => {
    const farmer = (await listFarmers(seedIds.verifiedHub, seedIds.cooperative))[0];
    const { id, hubId, cooperativeId, createdById, createdAt, updatedAt, possibleDuplicateOf, ...details } = farmer;
    void hubId; void cooperativeId; void createdById; void createdAt; void possibleDuplicateOf;
    const newer = new Date(Date.parse(updatedAt) + 60_000).toISOString();
    const older = new Date(Date.parse(updatedAt) - 60_000).toISOString();
    const [applied] = await applySyncBatch(fieldStaff, { items: [{ opId: "op-1", kind: "UPDATE_FARMER", recordId: id, recordedAt: newer, payload: { ...details, community: "Totota" } }] });
    const [stale] = await applySyncBatch(fieldStaff, { items: [{ opId: "op-2", kind: "UPDATE_FARMER", recordId: id, recordedAt: older, payload: { ...details, community: "Old value" } }] });
    expect([applied.status, stale.status]).toEqual(["APPLIED", "SUPERSEDED"]);
    expect((await getRepository().get("Farmer", id))!.community).toBe("Totota");
    const history = (await getRepository().list("AuditLog")).filter((entry) => entry.entityId === id);
    expect(history.map((entry) => entry.action).sort()).toEqual(["UPDATE", "UPDATE_SUPERSEDED"]);
    expect(JSON.parse(history.find((entry) => entry.action === "UPDATE")!.snapshot!).community).toBe(farmer.community);
  });

  it("rejects bad items individually and never lets other cooperatives write", async () => {
    const results = await applySyncBatch(fieldStaff, { items: [
      { opId: "bad", kind: "RECORD_DELIVERY", recordId: createUuidV7(), recordedAt: new Date().toISOString(), devicePriceMinorPerKg: 650, payload: { farmerId: "missing", cropId: "cassava", gradeId: "a", kilograms: "5" } },
      { opId: "good", kind: "CREATE_FARMER", recordId: createUuidV7(), recordedAt: new Date().toISOString(), payload: farmerPayload("Fine Farmer") },
    ] });
    expect(results.map((result) => [result.opId, result.status])).toEqual([["bad", "REJECTED"], ["good", "APPLIED"]]);
    await expect(applySyncBatch(await seededAccount("manufacturer"), { items: [{ opId: "x", kind: "CREATE_FARMER", recordId: createUuidV7(), recordedAt: new Date().toISOString(), payload: farmerPayload("X") }] })).rejects.toThrow();
  });

  it("never accepts times from the future", async () => {
    const farmerId = createUuidV7();
    await applySyncBatch(fieldStaff, { items: [{ opId: "op-1", kind: "CREATE_FARMER", recordId: farmerId, recordedAt: "2099-01-01T00:00:00.000Z", payload: farmerPayload("Time Traveller") }] });
    expect((await getRepository().get("Farmer", farmerId))!.createdAt < "2099").toBe(true);
  });

  it("packs what a device needs offline", async () => {
    const pack = await buildOfflinePack(fieldStaff);
    expect(pack.cooperative.name).toBe("Gbarnga Farmers Cooperative");
    expect(pack.farmers).toHaveLength(4);
    expect(pack.crops.find((crop) => crop.cropId === "cassava")?.grades.length).toBe(3);
  });
});

describe("offline sync batches", () => {
  it("accepts the queue item ids devices generate", async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
    const staff = await seededAccount("fieldstaff");
    const farmer = (await listFarmers(seedIds.verifiedHub, seedIds.cooperative))[0];
    const [result] = await applySyncBatch(staff, { items: [{ opId: createUuidV7(), kind: "RECORD_DELIVERY", recordId: createUuidV7(), recordedAt: new Date().toISOString(), devicePriceMinorPerKg: 650, payload: { farmerId: farmer.id, cropId: "cassava", gradeId: "a", kilograms: "12" } }] });
    expect(result.status).toBe("APPLIED");
  });
});
