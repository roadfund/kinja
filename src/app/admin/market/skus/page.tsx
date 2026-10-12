import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { SkuView } from "@/components/market/order-views";
import { ExportLinks } from "@/components/ops/export-links";
import { distributorStock } from "@/market/market-service";
import { orderParams, type OrderSearchParams } from "@/market/order-params";
import { orderDashboard } from "@/market/orders";
import { MarketTabs } from "../tabs";

export default async function HubSkusPage({ searchParams }: { searchParams: OrderSearchParams }) {
  const account = await requireDashboardRole(["HUB_ADMIN"], { verifiedHub: true });
  const { filters } = await orderParams(searchParams);
  const dashboard = await orderDashboard(account, filters);
  const distributorIds = dashboard.filters.distributorId ? [dashboard.filters.distributorId] : dashboard.distributors.map((distributor) => distributor.id);
  const stock = (await Promise.all(distributorIds.map((id) => distributorStock(account.scope.hubId, id)))).flat();
  return <DashboardShell actions={<ExportLinks datasets={["stock"]} />} eyebrow="Kinja Market" title="SKUs" description="Each finished product across your distributors: stock on hand, orders and revenue.">
    <MarketTabs active="SKUs" />
    <SkuView dashboard={dashboard} stock={stock} />
  </DashboardShell>;
}
