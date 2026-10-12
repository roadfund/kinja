import { beforeEach, describe, expect, it } from "vitest";
import { loadSeedData } from "@/dev/seed";
import { importSalesHistory, normalizePhone, parseCents, parseDate } from "@/dev/sales-import";
import { parseCsv } from "@/dev/sheet-source";
import { listInvoices } from "@/market/market-service";
import { orderDashboard } from "@/market/orders";
import { getRepository } from "@/repositories/server";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

// A tiny made-up sheet in the same shape as the hub's order spreadsheet.
const lines = parseCsv(`Status,Order No.,Date,Name,SKU,Quantity,Customer Category,SKU Price,Total Order Value (USD),Discount (%),Payment Value (USD),Payment Method,Delivery Date,Ordering Channel
Delivered,ABC0001,"  February 12, 2021",Test Shop,SKU_A,12,Wholesale,$1.00,$12.00,,$12.00,Cash,"  February 12, 2021",Team Member
Delivered,ABC0002,"  February 13, 2021",Test Shop,SKU_A,60,Wholesale,$1.00,$60.00,0.1,$54.00,Cash,"  February 13, 2021",Phone
Delivered,ABC0002,"  February 13, 2021",Test Shop,SKU_B,24,Wholesale,$0.50,$12.00,0.1,$10.80,Cash,"  February 13, 2021",Phone
Cancelled,ABC0003,"  March 1, 2021",Other Store,SKU_B,10,Retail,$0.50,$5.00,,$5.00,No Payment Found,"  March 1, 2021",Instagram
Delivered,ABC0004,"  March 2, 2021",Sample Person,SKU_A,1,Sample,$1.00,$1.00,,$1.00,No Payment Found,,Team Member
`);
const payments = parseCsv(`Date,Order No,Customer,USD Payment,LRD Payment,Exchange Rate,Total USD Payment,Payment Mode ,Processed by:
"February 12, 2021",ABC0001,Test Shop,,"$2,040.00",170,$12.00,Cash,Someone
"February 14, 2021",ABC0002,Test Shop,$70.00,,170,$70.00,TipMe,Someone
`);
const deliveries = parseCsv(`,,,,,,,,,,,,
,Delivery Date,Order Number,Customer's Name,Amount Due,Delivered By,,,Cancellation Date,Order Number,Customer's Name,Reason for cancelling,Processed by
,"February 13, 2021",ABC0002,Test Shop,$64.80,Rider One,,,"March 1, 2021",ABC0003,Other Store,Order is a repeat,Someone
`);
const reference = parseCsv(`,From,To,Exchange Rate
,"  February 1, 2021","  September 30, 2021",170
`);
const customers = parseCsv(`,No,Last Order Date,Customer,Contact,Address
,1,"Feb 13, 2021",Test Shop,0770000123,14th Street
`);

describe("sales history import", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withSampleSales: false });
  });

  it("parses the sheet's dates, money and phone numbers", () => {
    expect(parseDate("  February 12, 2021")).toBe("2021-02-12");
    expect(parseDate("Mar 1, 2021")).toBe("2021-03-01");
    expect(parseCents("$1,234.50")).toBe(123450);
    expect(normalizePhone("0770000123")).toBe("+231770000123");
    expect(normalizePhone("776410480")).toBe("+231776410480");
  });

  it("imports orders, payments, cancellations and rates, and the dashboards add up", async () => {
    const summary = await importSalesHistory([customers, reference, payments, deliveries, lines]);
    expect(summary).toMatchObject({ orders: 4, lines: 5, customers: 3, cancelled: 1, skus: ["SKU_A", "SKU_B"], rates: 1, firstDate: "2021-02-12", lastDate: "2021-03-02" });

    const distributor = await seededAccount("distributor");
    const { summary: totals, orders } = await orderDashboard(distributor);
    expect(orders.find((order) => order.reference === "ABC0002")).toMatchObject({ label: "ABC0002", deliveredBy: "Rider One", discountBasisPoints: 1000, valueMinor: 7200, paymentMinor: 6480, currency: "USD", channel: "PHONE" });
    expect(orders.find((order) => order.reference === "ABC0003")).toMatchObject({ status: "CANCELLED", cancelReason: "Order is a repeat", channel: "INSTAGRAM" });
    expect(totals.byStatus.DELIVERED.orders).toBe(3);

    // The sample with nothing paid is not invoiced; overpayment (70 on 64.80) is capped.
    const invoices = await listInvoices(distributor);
    expect(invoices.map((invoice) => [invoice.totalMinor, invoice.collectedMinor, invoice.status])).toEqual([[6480, 6480, "PAID"], [1200, 1200, "PAID"]]);
    const collections = await getRepository().list("Collection", distributor.hub!.id);
    expect(collections.map((collection) => collection.reference).sort()).toEqual(["Paid LRD 2040.00 at 170", "TipMe"]);
    expect((await getRepository().list("Customer", distributor.hub!.id)).find((customer) => customer.name === "Test Shop")).toMatchObject({ phone: "+231770000123", address: "14th Street" });
  });

  it("refuses a sheet without order lines", async () => {
    await expect(importSalesHistory([payments])).rejects.toThrow("order lines");
  });
});
