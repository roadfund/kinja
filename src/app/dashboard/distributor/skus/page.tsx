import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell } from "@/components/kinja/ui";
import { SkuView } from "@/components/market/order-views";
import { ExportLinks } from "@/components/ops/export-links";
import { distributorStock } from "@/market/market-service";
import { orderParams, type OrderSearchParams } from "@/market/order-params";
import { orderDashboard } from "@/market/orders";

export default async function DistributorSkusPage({ searchParams }: { searchParams: OrderSearchParams }) {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const { filters } = await orderParams(searchParams);
  const [dashboard, stock] = await Promise.all([orderDashboard(account, filters), distributorStock(account.scope.hubId, account.scope.organizationId)]);
  return <DashboardShell actions={<ExportLinks datasets={["stock"]} />} eyebrow="Kinja Market" title="SKUs" description="Each product you sell: what you hold, what was ordered, and what it brought in.">
    <SkuView dashboard={dashboard} stock={stock} />
  </DashboardShell>;
}
