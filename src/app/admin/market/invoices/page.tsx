import { FileText } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, EmptyState, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { InvoiceTable } from "@/components/market/market-tables";
import { ExportLinks } from "@/components/ops/export-links";
import { getMoneyContext } from "@/admin/exchange-rates";
import { MoneyCards } from "@/components/kinja/money";
import { formatIn, moneyItem } from "@/domain/currency";
import { listCustomers, listInvoices, listSales, type InvoiceRow } from "@/market/market-service";
import { MarketTabs } from "../tabs";

export default async function HubInvoicesPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const [customers, sales, invoices, money] = await Promise.all([listCustomers(account), listSales(account), listInvoices(account), getMoneyContext(account.hub!)]);
  const live = invoices.filter((invoice) => invoice.status !== "VOID");
  const overdue = live.filter((invoice) => invoice.status === "OVERDUE");
  const items = (rows: InvoiceRow[], field: "totalMinor" | "collectedMinor" | "outstandingMinor") => rows.map((invoice) => moneyItem(invoice[field], invoice.currency, invoice.issuedAt));
  return <DashboardShell actions={<ExportLinks datasets={["invoices"]} />} eyebrow="Kinja Market" title="Invoices" description="Invoices issued by your distributors, what has been collected, and what is still owed.">
    <MarketTabs active="Invoices" counts={{ customers: customers.length, sales: sales.length, invoices: invoices.length }} />
    <SummaryGrid>
      <SummaryCard detail={formatIn(money, items(live, "totalMinor"), money.primary)} label="Invoices" value={live.length} />
      <MoneyCards detail="Received against invoices" label="Collected" context={money} value={items(live, "collectedMinor")} />
      <MoneyCards detail="Still owed by customers" label="Outstanding" context={money} value={items(live, "outstandingMinor")} />
      <SummaryCard detail={formatIn(money, items(overdue, "outstandingMinor"), money.primary)} label="Overdue" tone={overdue.length ? "warning" : undefined} value={overdue.length} />
    </SummaryGrid>
    {invoices.length === 0 ? <EmptyState description="Invoices issued by your distributors appear here." icon={<FileText size={22} aria-hidden="true" />} title="No invoices yet" /> : <InvoiceTable invoices={invoices} money={money} showDistributor />}
  </DashboardShell>;
}
