import { FileText, PackageCheck, ShoppingBag } from "lucide-react";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { formatIn, moneyItem } from "@/domain/currency";
import { listTransfers } from "@/manufacture/manufacture-service";
import { distributorStock, listInvoices, listSales } from "@/market/market-service";
import { OrderDashboardView } from "@/components/market/order-dashboard";
import { orderParams, type OrderSearchParams } from "@/market/order-params";
import { orderDashboard } from "@/market/orders";
import { RoleDashboard } from "../role-dashboard";

export default async function DistributorDashboard({ searchParams }: { searchParams: OrderSearchParams }) {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const { filters } = await orderParams(searchParams);
  const [{ transfers }, stock, sales, invoices, dashboard] = await Promise.all([listTransfers(account), distributorStock(account.scope.hubId, account.scope.organizationId), listSales(account), listInvoices(account), orderDashboard(account, filters)]);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const toConfirm = transfers.filter((transfer) => transfer.direction === "IN" && transfer.status === "SENT" && !transfer.voidedAt).length;
  const outstanding = invoices.map((invoice) => moneyItem(invoice.outstandingMinor, invoice.currency, invoice.issuedAt));
  return <RoleDashboard account={account} eyebrow="Distributor" title="Bring products to market." description="Manage customers, record sales, issue invoices, and keep collections connected to the batches you sell." stats={[{ label: "To confirm", value: String(toConfirm), detail: `Incoming shipments · ${stock.filter((row) => row.availableThousandths > 0).length} batches in stock` }, { label: "Sales", value: String(sales.filter((sale) => !sale.voidedAt && sale.soldAt.startsWith(thisMonth)).length), detail: "This month" }, ...dashboard.money.currencies.map((currency) => ({ label: `Outstanding · ${currency}`, value: formatIn(dashboard.money, outstanding, currency), detail: `${invoices.filter((invoice) => invoice.status === "OVERDUE").length} overdue invoices` }))]} actions={[{ label: "Stock and shipments", description: "Confirm goods received and see what you hold.", href: "/dashboard/distributor/stock", icon: <PackageCheck size={20} aria-hidden="true" /> }, { label: "New order", description: "Record a customer order, one line per SKU.", href: "/dashboard/distributor/orders/new", icon: <ShoppingBag size={20} aria-hidden="true" /> }, { label: "Invoices and collections", description: "Issue invoices and record payments received.", href: "/dashboard/distributor/invoices", icon: <FileText size={20} aria-hidden="true" /> }]}><OrderDashboardView dashboard={dashboard} /></RoleDashboard>;
}
