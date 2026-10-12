import { beforeEach, describe, expect, it } from "vitest";
import { loadSeedData, seedIds } from "@/dev/seed";
import { createBatch, createFinishedGoodsTransfer, createRawMaterialTransfer, listBatches, listSendableDeliveries, listTransfers, listUnusedReceivedTransfers, receiveTransfer } from "@/manufacture/manufacture-service";
import type { Account } from "@/auth/server-store";
import { getRepository } from "@/repositories/server";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

describe("Kinja Manufacture", () => {
  let coopLead: Account;
  let manufacturer: Account;
  let distributor: Account;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
    [coopLead, manufacturer, distributor] = await Promise.all([seededAccount("cooplead"), seededAccount("manufacturer"), seededAccount("distributor")]);
  });

  async function cassavaDeliveryIds() {
    return (await listSendableDeliveries(seedIds.verifiedHub, seedIds.cooperative)).filter((delivery) => delivery.cropId === "cassava").map((delivery) => delivery.id);
  }

  it("runs raw material through a batch to a distributor, flagging discrepancies", async () => {
    const deliveryIds = await cassavaDeliveryIds();
    const raw = await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds, quantitySent: "75" });
    expect(await cassavaDeliveryIds()).toEqual([]);

    const received = await receiveTransfer(manufacturer, raw.id, { quantityReceived: "72.5" });
    expect(received).toMatchObject({ status: "RECEIVED", hasDiscrepancy: true });

    const batch = await createBatch(manufacturer, { newProductName: "Gari", newProductUnit: "KG", transferIds: [raw.id], quantityProduced: "29", wastageKg: "8" });
    expect(batch).toMatchObject({ number: 1, inputKg: "72.5" });
    expect((await listBatches(manufacturer))[0]).toMatchObject({ label: "B-0001", yieldLabel: "40.0%", remainingThousandths: 29000 });
    expect(await listUnusedReceivedTransfers(seedIds.verifiedHub, seedIds.manufacturer)).toEqual([]);

    await expect(createFinishedGoodsTransfer(manufacturer, { toOrganizationId: seedIds.distributor, batchId: batch.id, quantitySent: "30" })).rejects.toThrow("Only 29 left");
    const finished = await createFinishedGoodsTransfer(manufacturer, { toOrganizationId: seedIds.distributor, batchId: batch.id, quantitySent: "20" });
    expect((await receiveTransfer(distributor, finished.id, { quantityReceived: "20" })).hasDiscrepancy).toBe(false);
    expect((await listBatches(manufacturer))[0].remainingThousandths).toBe(9000);
  });

  it("only lets the receiving organization confirm, once", async () => {
    const raw = await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds: await cassavaDeliveryIds(), quantitySent: "75" });
    await expect(receiveTransfer(distributor, raw.id, { quantityReceived: "75" })).rejects.toThrow("not found");
    await expect(receiveTransfer(coopLead, raw.id, { quantityReceived: "75" })).rejects.toThrow("permission");
    await receiveTransfer(manufacturer, raw.id, { quantityReceived: "75" });
    await expect(receiveTransfer(manufacturer, raw.id, { quantityReceived: "75" })).rejects.toThrow("already confirmed");
  });

  it("rejects bad links: other crops, reused deliveries, wrong recipients, field staff", async () => {
    const deliveryIds = await cassavaDeliveryIds();
    const plantain = (await listSendableDeliveries(seedIds.verifiedHub, seedIds.cooperative)).find((delivery) => delivery.cropId === "plantain")!;
    await expect(createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds: [plantain.id], quantitySent: "5" })).rejects.toThrow("selected crop");
    await expect(createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.distributor, cropId: "cassava", deliveryIds, quantitySent: "5" })).rejects.toThrow("manufacturer");
    await expect(createRawMaterialTransfer(await seededAccount("fieldstaff"), { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds, quantitySent: "5" })).rejects.toThrow("permission");
    await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds, quantitySent: "5" });
    await expect(createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds, quantitySent: "5" })).rejects.toThrow("cannot be sent");
  });

  it("scopes transfer lists to the two organizations and the hub admin", async () => {
    await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds: await cassavaDeliveryIds(), quantitySent: "75" });
    expect((await listTransfers(coopLead)).transfers[0].direction).toBe("OUT");
    expect((await listTransfers(manufacturer)).transfers[0].direction).toBe("IN");
    expect((await listTransfers(distributor)).transfers).toEqual([]);
    expect((await listTransfers(await seededAccount("hubadmin"))).transfers).toHaveLength(1);
  });

  it("blocks members of a suspended organization", async () => {
    const organization = (await getRepository().get("Organization", seedIds.manufacturer))!;
    await getRepository().put("Organization", { ...organization, suspendedAt: new Date().toISOString() });
    await expect(listBatches(await seededAccount("manufacturer"))).rejects.toThrow("suspended");
  });
});
