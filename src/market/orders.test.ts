import { beforeEach, describe, expect, it } from "vitest";
import type { Account } from "@/auth/server-store";
import { loadSeedData, seedIds } from "@/dev/seed";
import { createBatch, createFinishedGoodsTransfer, createRawMaterialTransfer, listSendableDeliveries, receiveTransfer } from "@/manufacture/manufacture-service";
import { createInvoice, distributorStock, listSales, saveCustomer } from "@/market/market-service";
import { cancelOrder, createOrder, listOrders, markOrderDelivered, orderDashboard, splitDiscount } from "@/market/orders";
import { buildExport } from "@/ops/exports";
import { getRepository } from "@/repositories/server";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

const now = new Date("2026-06-10T10:00:00.000Z");

describe("Kinja Market orders", () => {
  let distributor: Account;
  let batchId: string;
  let customerId: string;
  const order = (overrides: Record<string, unknown> = {}) => ({ customerId, orderedOn: "2026-06-10", category: "WHOLESALE", channel: "PHONE", lines: [{ batchId, quantity: "4", unitPriceMinor: 10000 }], ...overrides });

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
    const [coopLead, manufacturer] = await Promise.all([seededAccount("cooplead"), seededAccount("manufacturer")]);
    distributor = await seededAccount("distributor");
    const deliveryIds = (await listSendableDeliveries(seedIds.verifiedHub, seedIds.cooperative)).filter((delivery) => delivery.cropId === "cassava").map((delivery) => delivery.id);
    const raw = await createRawMaterialTransfer(coopLead, { toOrganizationId: seedIds.manufacturer, cropId: "cassava", deliveryIds, quantitySent: "75" });
    await receiveTransfer(manufacturer, raw.id, { quantityReceived: "75" });
    batchId = (await createBatch(manufacturer, { newProductName: "SPC_PG90", newProductUnit: "UNIT", transferIds: [raw.id], quantityProduced: "30", wastageKg: "5" })).id;
    const finished = await createFinishedGoodsTransfer(manufacturer, { toOrganizationId: seedIds.distributor, batchId, quantitySent: "20" });
    await receiveTransfer(distributor, finished.id, { quantityReceived: "20" });
    customerId = (await saveCustomer(distributor, null, { name: "Stop and Shop", paymentTermsDays: 14 })).id;
  });

  it("creates an order as numbered sales lines with the discount split across them", async () => {
    const { order: created, sales } = await createOrder(distributor, order({ discountBasisPoints: 1000, lines: [{ batchId, quantity: "3", unitPriceMinor: 10000 }, { batchId, quantity: "2", unitPriceMinor: 5000 }] }), now);
    expect(created).toMatchObject({ number: 1, status: "PENDING", currency: "LRD" });
    expect(sales.map((sale) => [sale.amountMinor, sale.discountMinor])).toEqual([[30000, 3000], [10000, 1000]]);
    expect((await distributorStock(seedIds.verifiedHub, seedIds.distributor))[0].availableThousandths).toBe(15000);
    expect((await createOrder(distributor, order(), now)).order.number).toBe(2);
    const [row] = (await listOrders(distributor)).filter((item) => item.number === 1);
    expect(row).toMatchObject({ label: "ORD-0001", valueMinor: 40000, paymentMinor: 36000, quantityThousandths: 5000, customerName: "Stop and Shop" });
  });

  it("takes orders in the hub's second currency, and never mixes currencies on one invoice", async () => {
    const usd = await createOrder(distributor, order({ currency: "USD", delivered: true }), now);
    const lrd = await createOrder(distributor, order({ delivered: true }), now);
    expect(usd.sales[0].currency).toBe("USD");
    await expect(createOrder(distributor, order({ currency: "EUR" }), now)).rejects.toThrow("LRD or USD");
    await expect(createInvoice(distributor, { customerId, saleIds: [usd.sales[0].id, lrd.sales[0].id] }, now)).rejects.toThrow("one currency");
    expect((await createInvoice(distributor, { customerId, saleIds: [usd.sales[0].id] }, now)).currency).toBe("USD");
  });

  it("keeps discount parts adding up to the whole", () => {
    expect(splitDiscount([100, 100, 100], 3333)).toEqual([34, 33, 33]);
    expect(splitDiscount([500, 0], 10_000)).toEqual([500, 0]);
  });

  it("checks stock across lines, future dates and active customers", async () => {
    await expect(createOrder(distributor, order({ lines: [{ batchId, quantity: "15", unitPriceMinor: 100 }, { batchId, quantity: "6", unitPriceMinor: 100 }] }), now)).rejects.toThrow("than you have in stock");
    await expect(createOrder(distributor, order({ orderedOn: "2026-06-11" }), now)).rejects.toThrow("future");
    await expect(createOrder(await seededAccount("hubadmin"), order(), now)).rejects.toThrow();
  });

  it("invoices only delivered orders, at the discounted amount", async () => {
    const { order: created, sales } = await createOrder(distributor, order({ discountBasisPoints: 2500 }), now);
    await expect(createInvoice(distributor, { customerId, saleIds: sales.map((sale) => sale.id) }, now)).rejects.toThrow("delivered");
    expect((await listSales(distributor))[0].invoiceable).toBe(false);
    await markOrderDelivered(distributor, created.id, { deliveredOn: "2026-06-10", deliveredBy: "Levi H. Martin" }, now);
    const invoice = await createInvoice(distributor, { customerId, saleIds: sales.map((sale) => sale.id) }, now);
    expect(invoice.totalMinor).toBe(30000);
    expect((await listOrders(distributor))[0]).toMatchObject({ status: "DELIVERED", deliveredBy: "Levi H. Martin", invoiceLabels: ["INV-0001"] });
    await expect(cancelOrder(distributor, created.id, { reason: "Customer changed mind" }, now)).rejects.toThrow("already delivered");
  });

  it("cancels a pending order by voiding its sales, which frees the stock", async () => {
    const { order: created } = await createOrder(distributor, order({ lines: [{ batchId, quantity: "6", unitPriceMinor: 10000 }] }), now);
    await cancelOrder(distributor, created.id, { reason: "Customer closed the shop" }, now);
    expect((await distributorStock(seedIds.verifiedHub, seedIds.distributor))[0].availableThousandths).toBe(20000);
    expect((await getRepository().list("Sale", seedIds.verifiedHub)).every((sale) => sale.voidedAt && sale.voidReason?.includes("closed the shop"))).toBe(true);
    // Cancelled quantities still show on the dashboard.
    expect((await listOrders(distributor))[0]).toMatchObject({ status: "CANCELLED", quantityThousandths: 6000 });
    await expect(markOrderDelivered(distributor, created.id, { deliveredOn: "2026-06-10" }, now)).rejects.toThrow("already cancelled");
  });

  it("summarizes orders by status, SKU, category and channel", async () => {
    const delivered = await createOrder(distributor, order({ delivered: true, discountBasisPoints: 1000, lines: [{ batchId, quantity: "10", unitPriceMinor: 10000 }] }), now);
    await createOrder(distributor, order({ category: "RETAIL", channel: "WHATSAPP", lines: [{ batchId, quantity: "2", unitPriceMinor: 10000 }] }), now);
    const cancelled = await createOrder(distributor, order({ orderedOn: "2026-05-30", category: "SAMPLE", lines: [{ batchId, quantity: "1", unitPriceMinor: 10000 }] }), now);
    await cancelOrder(distributor, cancelled.order.id, { reason: "Duplicate entry" }, now);

    const { summary, months } = await orderDashboard(distributor);
    expect(months).toEqual(["2026-06", "2026-05"]);
    expect(summary.byStatus.DELIVERED).toEqual({ orders: 1, value: [{ minor: 100000, currency: "LRD", at: "2026-06-10T12:00:00.000Z" }], payment: [{ minor: 90000, currency: "LRD", at: "2026-06-10T12:00:00.000Z" }], quantityThousandths: 10000 });
    expect(summary.byStatus.PENDING.orders).toBe(1);
    expect(summary.byStatus.CANCELLED).toMatchObject({ orders: 1, quantityThousandths: 1000 });
    expect(summary.total).toMatchObject({ orders: 3, quantityThousandths: 13000 });
    expect(summary.skus).toEqual([{ productId: delivered.sales[0].productId, name: "SPC_PG90", unit: "UNIT", quantity: { DELIVERED: 10000, PENDING: 2000, CANCELLED: 1000 }, totalThousandths: 13000, deliveredValue: [{ minor: 100000, currency: "LRD", at: "2026-06-10T12:00:00.000Z" }], deliveredPayment: [{ minor: 90000, currency: "LRD", at: "2026-06-10T12:00:00.000Z" }] }]);
    expect(summary.byCategory.find((group) => group.key === "WHOLESALE")!.totals.payment.map((item) => item.minor)).toEqual([90000]);
    expect(summary.byCategory.find((group) => group.key === "RETAIL")!.totals.orders).toBe(0);
    expect((await orderDashboard(distributor, { year: "2026", month: "05" })).summary.total.orders).toBe(1);
    expect((await orderDashboard(distributor, { year: "2026" })).summary.total.orders).toBe(3);
    expect((await orderDashboard(distributor, { month: "05" })).summary.total.orders).toBe(3);
  });

  it("exports orders one row each, with SKUs side by side", async () => {
    await createOrder(distributor, order({ delivered: true, deliveredBy: "Sam Kollie", lines: [{ batchId, quantity: "12", unitPriceMinor: 100 }, { batchId, quantity: "6", unitPriceMinor: 100 }] }), now);
    const table = await buildExport(distributor, "orders");
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toEqual(expect.arrayContaining(["ORD-0001", "Delivered", "SPC_PG90, SPC_PG90", "12, 6", "Wholesale", "Phone", "Sam Kollie"]));
    await expect(buildExport(await seededAccount("manufacturer"), "orders")).rejects.toThrow("cannot export");
  });

  it("lets the hub admin see every distributor's orders, and nobody else's hub", async () => {
    await createOrder(distributor, order(), now);
    const hubAdmin = await seededAccount("hubadmin");
    expect(await listOrders(hubAdmin)).toHaveLength(1);
    expect(await listOrders(hubAdmin, { distributorId: "someone-else" })).toHaveLength(0);
    expect(await listOrders(await seededAccount("pendingadmin"))).toHaveLength(0);
    await expect(listOrders(await seededAccount("cooplead"))).rejects.toThrow("permission");
    await expect(markOrderDelivered(hubAdmin, (await listOrders(hubAdmin))[0].id, { deliveredOn: "2026-06-10" }, now)).rejects.toThrow();
  });
});
