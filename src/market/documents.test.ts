import { beforeEach, describe, expect, it } from "vitest";
import { loadSeedData } from "@/dev/seed";
import { buildInvoiceDocument } from "@/market/documents";
import { listInvoices, listSales } from "@/market/market-service";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("invoice and receipt documents", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData();
  });

  it("builds a designed invoice PDF on a white page, for the distributor and the hub admin", async () => {
    const distributor = await seededAccount("distributor");
    const invoice = (await listInvoices(distributor)).find((item) => item.collectedMinor > 0)!;
    const document = (await buildInvoiceDocument(distributor, invoice.id, "invoice"))!;
    expect(document.fileName).toMatch(/^inv-\d{4}-red-light-market-stall-4\.pdf$/);
    expect(text(document.bytes)).toMatch(/^%PDF-1\.4/);
    expect(text(document.bytes)).toContain("1 1 1 rg 0 0 595 842 re f");
    expect(text(document.bytes)).toContain("(INVOICE) Tj");
    expect(await buildInvoiceDocument(await seededAccount("hubadmin"), invoice.id, "invoice")).not.toBeNull();
    await expect(buildInvoiceDocument(await seededAccount("cooplead"), invoice.id, "invoice")).rejects.toThrow("permission");
  });

  it("issues a receipt only once a payment is recorded", async () => {
    const distributor = await seededAccount("distributor");
    const invoices = await listInvoices(distributor);
    const paid = invoices.find((item) => item.collectedMinor > 0)!;
    const unpaid = invoices.find((item) => item.collectedMinor === 0)!;
    expect(text((await buildInvoiceDocument(distributor, paid.id, "receipt"))!.bytes)).toContain("(RECEIPT) Tj");
    await expect(buildInvoiceDocument(distributor, unpaid.id, "receipt")).rejects.toThrow("No payment");
    expect((await listSales(distributor)).find((sale) => sale.invoiceId === paid.id)!.invoicePaid).toBe(true);
  });
});
