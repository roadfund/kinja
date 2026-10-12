import { beforeEach, describe, expect, it } from "vitest";
import type { Account } from "@/auth/server-store";
import { loadSeedData, seedIds } from "@/dev/seed";
import { createBatch, createFinishedGoodsTransfer, createRawMaterialTransfer, listSendableDeliveries, receiveTransfer } from "@/manufacture/manufacture-service";
import { createInvoice, createSale, distributorStock, invoiceStatus, listCollections, listCustomers, listInvoices, listSales, recordCollection, saveCustomer, setCustomerArchived } from "@/market/market-service";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

describe("Kinja Market", () => {
  let distributor: Account;
  let batchId: string;
  let customerId: string;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
    const [coopLead, manufacturer] = await Promise.all([seededAccount("cooplead"), seededAccount("manufacturer")]);
    distributor = await seededAccount("distributor");
    const deliveryIds = (await listSendableDeliveries(seedIds.verifiedHub, seedIds.cooperative)).filter((delivery) => delivery.cropId === "cassava").map((delivery) => delivery.id);
    const raw = await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds, quantitySent: "75" });
    await receiveTransfer(manufacturer, raw.id, { quantityReceived: "75" });
    batchId = (await createBatch(manufacturer, { newProductName: "Gari 1kg bag", newProductUnit: "UNIT", transferIds: [raw.id], quantityProduced: "30", wastageKg: "5" })).id;
    const finished = await createFinishedGoodsTransfer(manufacturer, { toOrganizationId: seedIds.distributor, batchId, quantitySent: "20" });
    await receiveTransfer(distributor, finished.id, { quantityReceived: "20" });
    customerId = (await saveCustomer(distributor, null, { name: "Red Light Market Stall", phone: "+231770005555", paymentTermsDays: 14 })).id;
  });

  it("manages customers and archives instead of deleting", async () => {
    const updated = await saveCustomer(await seededAccount("hubadmin"), customerId, { name: "Red Light Stall 4", paymentTermsDays: "30" });
    expect(updated).toMatchObject({ name: "Red Light Stall 4", paymentTermsDays: 30, phone: undefined });
    await setCustomerArchived(distributor, customerId, true);
    expect((await listCustomers(distributor)).map((customer) => customer.id)).not.toContain(customerId);
    await expect(createSale(distributor, { customerId, batchId, quantity: "1", unitPriceMinor: 5000 })).rejects.toThrow("active customer");
    await expect(listCustomers(await seededAccount("cooplead"))).rejects.toThrow("permission");
  });

  it("sells from received stock only, traced to the batch", async () => {
    expect((await distributorStock(seedIds.verifiedHub, seedIds.distributor))[0]).toMatchObject({ batchLabel: "B-0001", availableThousandths: 20000 });
    const sale = await createSale(distributor, { customerId, batchId, quantity: "12", unitPriceMinor: 15000 });
    expect(sale).toMatchObject({ amountMinor: 180000, currency: "LRD", batchId });
    expect((await distributorStock(seedIds.verifiedHub, seedIds.distributor))[0].availableThousandths).toBe(8000);
    await expect(createSale(distributor, { customerId, batchId, quantity: "9", unitPriceMinor: 15000 })).rejects.toThrow("more than you have");
    expect((await listSales(distributor))[0]).toMatchObject({ customerName: "Red Light Market Stall", batchLabel: "B-0001", productName: "Gari 1kg bag" });
  });

  it("numbers invoices per hub, tracks collections and computes status", async () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    const first = await createSale(distributor, { customerId, batchId, quantity: "2", unitPriceMinor: 15000 }, now);
    const second = await createSale(distributor, { customerId, batchId, quantity: "3", unitPriceMinor: 15000 }, now);
    const invoice = await createInvoice(distributor, { customerId, saleIds: [first.id, second.id] }, now);
    expect(invoice).toMatchObject({ number: 1, totalMinor: 75000, dueDate: "2026-06-15" });
    await expect(createInvoice(distributor, { customerId, saleIds: [first.id] }, now)).rejects.toThrow("uninvoiced");

    await recordCollection(distributor, invoice.id, { amountMinor: 25000, method: "MOBILE_MONEY", reference: "MM-123" }, now);
    expect((await listInvoices(distributor, now))[0]).toMatchObject({ status: "PARTIALLY_PAID", collectedMinor: 25000, outstandingMinor: 50000 });
    expect((await listInvoices(distributor, new Date("2026-06-20T00:00:00.000Z")))[0].status).toBe("OVERDUE");
    await expect(recordCollection(distributor, invoice.id, { amountMinor: 60000, method: "CASH" }, now)).rejects.toThrow("more than what is still owed");
    await recordCollection(distributor, invoice.id, { amountMinor: 50000, method: "CASH" }, now);
    expect((await listInvoices(distributor, new Date("2026-07-01T00:00:00.000Z")))[0].status).toBe("PAID");
    expect(await listCollections(distributor)).toHaveLength(2);

    const third = await createSale(distributor, { customerId, batchId, quantity: "1", unitPriceMinor: 15000 }, now);
    expect((await createInvoice(distributor, { customerId, saleIds: [third.id] }, now)).number).toBe(2);
  });

  it("marks voided invoices as void", () => {
    const base = { id: "i", hubId: "h", distributorId: "d", number: 1, customerId: "c", saleIds: ["s"], totalMinor: 100, currency: "LRD", issuedAt: "2026-01-01T00:00:00.000Z", dueDate: "2026-01-15", createdById: "u", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    expect(invoiceStatus({ ...base, voidedAt: "2026-01-02T00:00:00.000Z" }, 0)).toBe("VOID");
    expect(invoiceStatus(base, 0, new Date("2026-01-10T00:00:00.000Z"))).toBe("ISSUED");
  });
});
