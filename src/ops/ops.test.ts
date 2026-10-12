import { beforeEach, describe, expect, it } from "vitest";
import { authenticate, getAccountFromSession, createSession, type Account } from "@/auth/server-store";
import { loadSeedData, seedIds } from "@/dev/seed";
import { listOutbox } from "@/email/outbox";
import { listDeliveries } from "@/field/deliveries";
import { listInvoices } from "@/market/market-service";
import { buildExport } from "@/ops/exports";
import { computeImpact } from "@/ops/impact";
import { listAuditLog, setHubSuspended, setMemberSuspended, setOrganizationSuspended, voidRecord } from "@/ops/moderation";
import { ensureMonthlyReports, listMonthlyReports, previousMonth } from "@/ops/monthly-reports";
import { buildPdf, toCsv } from "@/ops/pdf";
import { toXlsx } from "@/ops/xlsx";
import { getRepository } from "@/repositories/server";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

const ORIGIN = "http://localhost:3000";

describe("Kinja Ops", () => {
  let techAdmin: Account;
  let hubAdmin: Account;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData();
    [techAdmin, hubAdmin] = await Promise.all([seededAccount("techadmin"), seededAccount("hubadmin")]);
  });

  it("computes impact: farmers reached, women share, local sourcing, crop and grade split", async () => {
    const impact = await computeImpact(seedIds.verifiedHub);
    expect(impact.farmersReached).toBe(4);
    expect(impact.womenReached).toBe(3);
    expect(impact.womenShare).toBeCloseTo(0.75);
    expect(impact.localSourcingShare).toBe(1);
    expect(impact.byCropAndGrade.reduce((sum, row) => sum + row.deliveries, 0)).toBe(impact.deliveries);
    expect((await computeImpact(seedIds.verifiedHub, { cooperativeId: "other-coop" })).farmersReached).toBe(0);
  });

  it("generates last month's report once per hub and emails the hub admin", async () => {
    const now = new Date();
    const created = await ensureMonthlyReports(hubAdmin, ORIGIN, now);
    expect(created.map((report) => report.month)).toEqual([previousMonth(now)]);
    expect(await ensureMonthlyReports(hubAdmin, ORIGIN, now)).toEqual([]);
    expect(await ensureMonthlyReports(techAdmin, ORIGIN, now)).toEqual([]);
    expect(await listMonthlyReports(seedIds.verifiedHub)).toHaveLength(1);
    expect((await listOutbox()).some((email) => email.subject.includes("monthly report"))).toBe(true);
    await expect(ensureMonthlyReports(await seededAccount("cooplead"), ORIGIN, now)).rejects.toThrow("permission");
  });

  it("exports only what each role can see", async () => {
    const coopFarmers = await buildExport(await seededAccount("cooplead"), "farmers");
    expect(coopFarmers.rows).toHaveLength(4);
    await expect(buildExport(await seededAccount("cooplead"), "sales")).rejects.toThrow("cannot export");
    await expect(buildExport(await seededAccount("fieldstaff"), "transfers")).rejects.toThrow("cannot export");
    const distributorSales = await buildExport(await seededAccount("distributor"), "sales");
    expect(distributorSales.rows.length).toBeGreaterThan(0);
    expect((await buildExport(techAdmin, "invoices", seedIds.verifiedHub)).rows).toHaveLength((await listInvoices(hubAdmin)).length);
    expect((await buildExport(await seededAccount("manufacturer"), "stock")).headers[0]).toBe("Batch");
  });

  it("writes an Excel file as a zip with a sheet, numbers kept as numbers", () => {
    const file = toXlsx("Orders - Jimmy's Group", ["Order", "Qty"], [["ORD-0001", "12"], ["<b> & co", "3.5"]]);
    expect([...file.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(file);
    expect(text).toContain('<sheet name="Orders - Jimmy&apos;s Group"'.replace("&apos;", "'"));
    expect(text).toContain('<c r="B2"><v>12</v></c>');
    expect(text).toContain("&lt;b&gt; &amp; co");
  });

  it("writes CSV and a valid PDF", () => {
    expect(toCsv(["Name", "Note"], [["Ada", 'said "hi", then left']])).toBe('Name,Note\nAda,"said ""hi"", then left"');
    const pdf = new TextDecoder().decode(buildPdf("Report", "Sub", [{ heading: "Table", table: { headers: ["A", "B"], rows: Array.from({ length: 80 }, (_, i) => [`row ${i}`, "(x)"]) } }]));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 3");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("suspends and reinstates users, organizations and hubs, with an audit trail", async () => {
    const coopLead = await seededAccount("cooplead");
    const session = await createSession(coopLead.user.id);
    await setMemberSuspended(techAdmin, coopLead.membership!.id, { suspend: true, reason: "Reported misuse" });
    expect(await getAccountFromSession(session)).toBeNull();
    expect((await authenticate("cooplead", "kinja-dev-password"))!.account.membership!.status).toBe("SUSPENDED");
    await setMemberSuspended(techAdmin, coopLead.membership!.id, { suspend: false, reason: "Resolved" });

    await setOrganizationSuspended(techAdmin, seedIds.distributor, { suspend: true, reason: "Unpaid fees" });
    await expect(listInvoices(await seededAccount("distributor"))).rejects.toThrow("suspended");

    await setHubSuspended(techAdmin, seedIds.verifiedHub, { suspend: true, reason: "Investigation" });
    await expect(listInvoices(await seededAccount("hubadmin"))).rejects.toThrow("not available");
    await expect(setHubSuspended(techAdmin, seedIds.verifiedHub, { suspend: true, reason: "Again" })).rejects.toThrow("Only verified");
    await expect(setHubSuspended(hubAdmin, seedIds.verifiedHub, { suspend: false, reason: "Self" })).rejects.toThrow("permission");
    await expect(setMemberSuspended(techAdmin, coopLead.membership!.id, { suspend: true, reason: "" })).rejects.toThrow();

    // The seed also cancels an order, which is audited too.
    expect((await listAuditLog(techAdmin)).filter((entry) => entry.entity !== "Order").map((entry) => entry.action)).toEqual(["SUSPEND", "SUSPEND", "REINSTATE", "SUSPEND"]);
  });

  it("voids records in dependency order and keeps them", async () => {
    const repository = getRepository();
    const delivery = (await repository.list("Delivery", seedIds.verifiedHub)).find((item) => item.cropId === "cassava")!;
    await expect(voidRecord(techAdmin, "Delivery", delivery.id, { reason: "Wrong farmer" })).rejects.toThrow("Void the transfer first");

    const invoice = (await repository.list("Invoice", seedIds.verifiedHub)).find((item) => item.saleIds.length > 0)!;
    const collections = (await repository.list("Collection", seedIds.verifiedHub)).filter((item) => item.invoiceId === invoice.id);
    if (collections.length) await expect(voidRecord(techAdmin, "Invoice", invoice.id, { reason: "Duplicate" })).rejects.toThrow("Void the collections first");
    for (const collection of collections) await voidRecord(techAdmin, "Collection", collection.id, { reason: "Entered twice" });
    await voidRecord(techAdmin, "Invoice", invoice.id, { reason: "Duplicate invoice" });
    expect((await listInvoices(hubAdmin)).find((item) => item.id === invoice.id)!.status).toBe("VOID");
    expect((await repository.get("Sale", invoice.saleIds[0]))!.invoiceId).toBeUndefined();
    await expect(voidRecord(techAdmin, "Invoice", invoice.id, { reason: "Again" })).rejects.toThrow("already voided");

    const loose = (await listDeliveries(seedIds.verifiedHub, seedIds.cooperative)).find((item) => item.cropId === "plantain")!;
    await voidRecord(techAdmin, "Delivery", loose.id, { reason: "Weighed twice" });
    expect((await repository.get("Delivery", loose.id))!).toMatchObject({ voidReason: "Weighed twice", voidedById: techAdmin.user.id });
    await expect(voidRecord(hubAdmin, "Delivery", loose.id, { reason: "x" })).rejects.toThrow("permission");
  });
});
