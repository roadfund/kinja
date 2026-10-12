import { Plus } from "lucide-react";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, LinkButton, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { CustomerTable } from "@/components/market/customer-table";
import { listCustomers, listInvoices } from "@/market/market-service";

export default async function DistributorCustomersPage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [customers, invoices] = await Promise.all([listCustomers(account, { includeArchived: true }), listInvoices(account)]);
  const active = customers.filter((customer) => !customer.archivedAt);
  return <DashboardShell eyebrow="Kinja Market" title="Customers" description="The buyers your hub sells to. Customers are shared across your hub.">
    <SummaryGrid columns={3}>
      <SummaryCard detail={`${customers.length - active.length} archived`} label="Active customers" value={active.length} />
      <SummaryCard detail="Customers you have invoiced" label="Invoiced" value={new Set(invoices.map((invoice) => invoice.customerId)).size} />
      <SummaryCard detail="Customers with overdue invoices" label="Overdue" tone={invoices.some((invoice) => invoice.status === "OVERDUE") ? "warning" : undefined} value={new Set(invoices.filter((invoice) => invoice.status === "OVERDUE").map((invoice) => invoice.customerId)).size} />
    </SummaryGrid>
    <SectionHeader action={<LinkButton href="/dashboard/distributor/customers/new" icon={<Plus size={17} aria-hidden="true" />}>Add customer</LinkButton>} title="All customers" />
    <CustomerTable basePath="/dashboard/distributor/customers" customers={customers} />
  </DashboardShell>;
}
