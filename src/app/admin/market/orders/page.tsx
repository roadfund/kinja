import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { OrdersView } from "@/components/market/order-views";
import { ExportLinks } from "@/components/ops/export-links";
import { orderParams, type OrderSearchParams } from "@/market/order-params";
import { orderDashboard } from "@/market/orders";
import { MarketTabs } from "../tabs";

export default async function HubOrdersPage({ searchParams }: { searchParams: OrderSearchParams }) {
  const account = await requireDashboardRole(["HUB_ADMIN"], { verifiedHub: true });
  const { filters, status } = await orderParams(searchParams);
  const dashboard = await orderDashboard(account, filters);
  return <DashboardShell actions={<ExportLinks datasets={["orders"]} />} eyebrow="Kinja Market" title="Orders" description="Every customer order taken by your distributors, by status, SKU and period.">
    <MarketTabs active="Orders" counts={{ orders: dashboard.orders.length }} />
    <OrdersView basePath="/admin/market/orders" dashboard={dashboard} status={status} />
  </DashboardShell>;
}
