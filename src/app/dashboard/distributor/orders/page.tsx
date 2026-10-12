import { Plus } from "lucide-react";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, LinkButton } from "@/components/kinja/ui";
import { OrdersView } from "@/components/market/order-views";
import { ExportLinks } from "@/components/ops/export-links";
import { deliveredByNames, orderParams, type OrderSearchParams } from "@/market/order-params";
import { hubToday, listOrders, orderDashboard } from "@/market/orders";

export default async function DistributorOrdersPage({ searchParams }: { searchParams: OrderSearchParams }) {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const { filters, status } = await orderParams(searchParams);
  const [dashboard, all] = await Promise.all([orderDashboard(account, filters), listOrders(account)]);
  return <DashboardShell actions={<ExportLinks datasets={["orders"]} />} eyebrow="Kinja Market" title="Orders" description="Customer orders, one line per SKU. Mark them delivered when they reach the customer.">
    <OrdersView actions basePath="/dashboard/distributor/orders" dashboard={dashboard} deliveredByNames={deliveredByNames(all)} newOrderAction={<LinkButton href="/dashboard/distributor/orders/new" icon={<Plus size={17} aria-hidden="true" />}>New order</LinkButton>} status={status} today={hubToday(account.hub!)} />
  </DashboardShell>;
}
