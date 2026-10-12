import { requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { getMoneyContext } from "@/admin/exchange-rates";
import { convertMinor, formatDual, moneyItem } from "@/domain/currency";
import { createUuidV7 } from "@/domain/id";
import { fromThousandths, toThousandths } from "@/domain/money";
import type { MonthlyReport, MonthlyReportData } from "@/domain/model";
import { sendEmail } from "@/email/outbox";
import { yieldPercent } from "@/manufacture/manufacture-service";
import { invoiceStatus } from "@/market/market-service";
import { getRepository } from "@/repositories/server";

export function previousMonth(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Report totals convert to other currencies at the rate in force late in the month.
export const reportMoment = (month: string) => `${month}-28T12:00:00.000Z`;

const inMonth = (iso: string | undefined, month: string) => Boolean(iso?.startsWith(month));

export async function buildMonthlyReportData(hubId: string, month: string, now = new Date()): Promise<MonthlyReportData> {
  const repository = getRepository();
  const [hub, farmers, deliveries, transfers, batches, products, sales, invoices, collections, customers, payouts] = await Promise.all([repository.get("Hub", hubId), repository.list("Farmer", hubId), repository.list("Delivery", hubId), repository.list("Transfer", hubId), repository.list("Batch", hubId), repository.list("Product", hubId), repository.list("Sale", hubId), repository.list("Invoice", hubId), repository.list("Collection", hubId), repository.list("Customer", hubId), repository.list("Payout", hubId)]);
  const live = <T extends { voidedAt?: string }>(items: T[]) => items.filter((item) => !item.voidedAt);
  // Reports are kept in the hub's main currency: amounts in other currencies convert at their own date's rate.
  const money = await getMoneyContext(hub ?? { countryId: "lr" });
  const main = (minor: number, currency: string, at: string) => convertMinor(money, moneyItem(minor, currency, at), money.primary) ?? minor;
  const saleMain = (sale: (typeof sales)[number]) => main(sale.amountMinor - (sale.discountMinor ?? 0), sale.currency, sale.soldAt);
  const monthSales = live(sales).filter((sale) => inMonth(sale.soldAt, month));
  const monthDeliveries = live(deliveries).filter((delivery) => inMonth(delivery.createdAt, month));
  const monthBatches = live(batches).filter((batch) => inMonth(batch.producedAt, month));
  const unitOf = (productId: string) => products.find((product) => product.id === productId)?.unit ?? "KG";
  const received = live(transfers).filter((transfer) => transfer.kind === "RAW_MATERIAL" && inMonth(transfer.receivedAt, month));
  const paidPayouts = payouts.filter((payout) => payout.status === "SUCCEEDED" && inMonth(payout.updatedAt, month));
  const kgYields = monthBatches.filter((batch) => unitOf(batch.productId) === "KG").map((batch) => yieldPercent(batch)).filter((value): value is number => value !== null);

  const byCustomer = new Map<string, number>();
  const byProduct = new Map<string, { amountMinor: number; thousandths: number }>();
  for (const sale of monthSales) {
    const customer = customers.find((item) => item.id === sale.customerId)?.name ?? "Customer";
    byCustomer.set(customer, (byCustomer.get(customer) ?? 0) + saleMain(sale));
    const product = products.find((item) => item.id === sale.productId)?.name ?? "Product";
    const entry = byProduct.get(product) ?? { amountMinor: 0, thousandths: 0 };
    byProduct.set(product, { amountMinor: entry.amountMinor + saleMain(sale), thousandths: entry.thousandths + toThousandths(sale.quantity) });
  }
  const collectedFor = (invoiceId: string) => live(collections).filter((collection) => collection.invoiceId === invoiceId).reduce((sum, collection) => sum + collection.amountMinor, 0);
  const overdue = live(invoices).filter((invoice) => invoiceStatus(invoice, collectedFor(invoice.id), now) === "OVERDUE");

  return {
    currency: money.primary,
    financial: {
      salesMinor: monthSales.reduce((sum, sale) => sum + saleMain(sale), 0),
      invoicedMinor: live(invoices).filter((invoice) => inMonth(invoice.issuedAt, month)).reduce((sum, invoice) => sum + main(invoice.totalMinor, invoice.currency, invoice.issuedAt), 0),
      collectedMinor: live(collections).filter((collection) => inMonth(collection.receivedAt, month)).reduce((sum, collection) => sum + main(collection.amountMinor, invoices.find((invoice) => invoice.id === collection.invoiceId)?.currency ?? money.primary, collection.receivedAt), 0),
      paidToFarmersMinor: paidPayouts.reduce((sum, payout) => sum + main(payout.amountMinor, payout.currency, payout.updatedAt), 0),
    },
    operations: {
      receivedKg: fromThousandths(received.reduce((sum, transfer) => sum + toThousandths(transfer.quantityReceived!), 0)),
      producedKg: fromThousandths(monthBatches.filter((batch) => unitOf(batch.productId) === "KG").reduce((sum, batch) => sum + toThousandths(batch.quantityProduced), 0)),
      producedUnits: fromThousandths(monthBatches.filter((batch) => unitOf(batch.productId) === "UNIT").reduce((sum, batch) => sum + toThousandths(batch.quantityProduced), 0)),
      wastageKg: fromThousandths(monthBatches.reduce((sum, batch) => sum + toThousandths(batch.wastageKg), 0)),
      averageYieldPercent: kgYields.length ? Math.round((kgYields.reduce((a, b) => a + b, 0) / kgYields.length) * 10) / 10 : null,
      discrepancies: live(transfers).filter((transfer) => transfer.hasDiscrepancy && inMonth(transfer.receivedAt, month)).length,
    },
    farmers: {
      newRegistrations: farmers.filter((farmer) => inMonth(farmer.createdAt, month)).length,
      activeFarmers: new Set(monthDeliveries.map((delivery) => delivery.farmerId)).size,
      deliveries: monthDeliveries.length,
      payouts: paidPayouts.length,
    },
    sales: {
      byCustomer: [...byCustomer].map(([name, amountMinor]) => ({ name, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor),
      byProduct: [...byProduct].map(([name, entry]) => ({ name, amountMinor: entry.amountMinor, quantity: fromThousandths(entry.thousandths) })).sort((a, b) => b.amountMinor - a.amountMinor),
      overdueInvoices: overdue.length,
      overdueMinor: overdue.reduce((sum, invoice) => sum + main(invoice.totalMinor - collectedFor(invoice.id), invoice.currency, invoice.issuedAt), 0),
    },
  };
}

// Run when a hub admin or tech admin opens Kinja Ops: creates last month's report
// for each hub that does not have one yet, and emails it to the hub admins.
export async function ensureMonthlyReports(account: Account, origin: string, now = new Date()): Promise<MonthlyReport[]> {
  const scope = requireRole(account, ["HUB_ADMIN", "TECH_ADMIN"]);
  const repository = getRepository();
  const month = previousMonth(now);
  const hubs = scope.role === "TECH_ADMIN" ? (await repository.list("Hub")).filter((hub) => hub.status === "VERIFIED") : [account.hub!];
  const existing = await repository.list("MonthlyReport");
  const created: MonthlyReport[] = [];
  for (const hub of hubs) {
    if (existing.some((report) => report.hubId === hub.id && report.month === month)) continue;
    const timestamp = now.toISOString();
    const report: MonthlyReport = { id: createUuidV7(), hubId: hub.id, month, data: await buildMonthlyReportData(hub.id, month, now), createdById: "system", createdAt: timestamp, updatedAt: timestamp };
    await repository.put("MonthlyReport", report);
    created.push(report);

    const admins = (await repository.list("Membership", hub.id)).filter((membership) => membership.role === "HUB_ADMIN" && membership.status === "ACTIVE");
    for (const admin of admins) {
      const user = await repository.get("User", admin.userId);
      if (!user?.email) continue;
      const link = `${origin}/admin/ops/reports/${month}`;
      const money = await getMoneyContext(hub);
      await sendEmail({ to: user.email, subject: `${hub.businessName}: monthly report for ${monthLabel(month)}`, text: `Your Kinja monthly report for ${monthLabel(month)} is ready.\n\nSales: ${formatDual(money, moneyItem(report.data.financial.salesMinor, report.data.currency, reportMoment(month)))}\nCollected: ${formatDual(money, moneyItem(report.data.financial.collectedMinor, report.data.currency, reportMoment(month)))}\nActive farmers: ${report.data.farmers.activeFarmers}\nDeliveries: ${report.data.farmers.deliveries}\n\nOpen the full report, with PDF and CSV downloads:\n${link}`, link }, now);
    }
  }
  return created;
}

export async function listMonthlyReports(hubId: string): Promise<MonthlyReport[]> {
  return (await getRepository().list("MonthlyReport", hubId)).sort((a, b) => b.month.localeCompare(a.month));
}
