import { Plus } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, LinkButton, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { CustomerTable } from "@/components/market/customer-table";
import { listCustomers, listInvoices, listSales } from "@/market/market-service";
import { MarketTabs } from "./tabs";

export default async function HubCustomersPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const [customers, sales, invoices] = await Promise.all([listCustomers(account, { includeArchived: true }), listSales(account), listInvoices(account)]);
  const active = customers.filter((customer) => !customer.archivedAt);
  const overdueCustomers = new Set(invoices.filter((invoice) => invoice.status === "OVERDUE").map((invoice) => invoice.customerId)).size;
  return <DashboardShell actions={<LinkButton href="/admin/market/customers/new" icon={<Plus size={17} aria-hidden="true" />}>Add customer</LinkButton>} eyebrow="Kinja Market" title="Customers" description="Your hub's customers. Distributors sell to them and invoice them.">
    <MarketTabs active="Customers" counts={{ customers: active.length, sales: sales.length, invoices: invoices.length }} />
    <SummaryGrid columns={3}>
      <SummaryCard detail={`${customers.length - active.length} archived`} label="Active customers" value={active.length} />
      <SummaryCard detail="Customers with at least one sale" label="Buying" value={new Set(sales.filter((sale) => !sale.voidedAt).map((sale) => sale.customerId)).size} />
      <SummaryCard detail="Customers with an overdue invoice" label="Overdue" tone={overdueCustomers ? "warning" : undefined} value={overdueCustomers} />
    </SummaryGrid>
    <CustomerTable basePath="/admin/market/customers" customers={customers} />
  </DashboardShell>;
}
