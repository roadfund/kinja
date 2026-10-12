import { FileText, Plus } from "lucide-react";
import { ExportLinks } from "@/components/ops/export-links";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, EmptyState, LinkButton, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { InvoiceTable } from "@/components/market/market-tables";
import { getMoneyContext } from "@/admin/exchange-rates";
import { MoneyCards } from "@/components/kinja/money";
import { formatIn, moneyItem } from "@/domain/currency";
import { listInvoices, type InvoiceRow } from "@/market/market-service";

export default async function InvoicesPage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [invoices, money] = await Promise.all([listInvoices(account), getMoneyContext(account.hub!)]);
  const items = (rows: InvoiceRow[], field: "totalMinor" | "collectedMinor" | "outstandingMinor") => rows.map((invoice) => moneyItem(invoice[field], invoice.currency, invoice.issuedAt));
  const live = invoices.filter((invoice) => invoice.status !== "VOID");
  const overdue = live.filter((invoice) => invoice.status === "OVERDUE");
  return <DashboardShell actions={<ExportLinks datasets={["invoices"]} />} eyebrow="Kinja Market" title="Invoices" description="Numbered invoices for your sales, what has been collected, and what is still owed.">
    <SummaryGrid>
      <SummaryCard detail={formatIn(money, items(live, "totalMinor"), money.primary)} label="Invoices" value={live.length} />
      <MoneyCards detail="Received against invoices" label="Collected" context={money} value={items(live, "collectedMinor")} />
      <MoneyCards detail="Still owed by customers" label="Outstanding" context={money} value={items(live, "outstandingMinor")} />
      <SummaryCard detail={formatIn(money, items(overdue, "outstandingMinor"), money.primary)} label="Overdue" tone={overdue.length ? "warning" : undefined} value={overdue.length} />
    </SummaryGrid>
    <SectionHeader action={<LinkButton href="/dashboard/distributor/invoices/new" icon={<Plus size={17} aria-hidden="true" />}>Issue invoice</LinkButton>} description={`${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"}`} title="All invoices" />
    {invoices.length === 0 ? <EmptyState description="Issue an invoice for one or more sales to a customer." icon={<FileText size={22} aria-hidden="true" />} title="No invoices yet" /> : <InvoiceTable invoices={invoices} money={money} linkBase="/dashboard/distributor/invoices" />}
  </DashboardShell>;
}
