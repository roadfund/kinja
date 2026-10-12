import { Plus, ShoppingCart } from "lucide-react";
import { ExportLinks } from "@/components/ops/export-links";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, EmptyState, LinkButton, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { SalesTable } from "@/components/market/market-tables";
import { getMoneyContext } from "@/admin/exchange-rates";
import { MoneyCards } from "@/components/kinja/money";
import { formatIn, moneyItem } from "@/domain/currency";
import { listSales, saleNetMinor, type SaleRow } from "@/market/market-service";

export default async function SalesPage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [sales, money] = await Promise.all([listSales(account), getMoneyContext(account.hub!)]);
  const live = sales.filter((sale) => !sale.voidedAt);
  const items = (rows: SaleRow[]) => rows.map((sale) => moneyItem(saleNetMinor(sale), sale.currency, sale.soldAt));
  const thisMonth = new Date().toISOString().slice(0, 7);
  const uninvoiced = live.filter((sale) => sale.invoiceable);
  return <DashboardShell actions={<ExportLinks datasets={["sales"]} />} eyebrow="Kinja Market" title="Sales" description="Every sale, traced to the batch it came from.">
    <SummaryGrid>
      <SummaryCard detail={`${live.filter((sale) => sale.soldAt.startsWith(thisMonth)).length} this month`} label="Sales" value={live.length} />
      <MoneyCards detail="All recorded sales" label="Sales value" context={money} value={items(live)} />
      <SummaryCard detail="Customers bought from you" label="Customers" value={new Set(live.map((sale) => sale.customerId)).size} />
      <SummaryCard detail={formatIn(money, items(uninvoiced), money.primary)} label="Not invoiced" tone={uninvoiced.length ? "warning" : undefined} value={uninvoiced.length} />
    </SummaryGrid>
    <SectionHeader action={<LinkButton href="/dashboard/distributor/orders/new" icon={<Plus size={17} aria-hidden="true" />}>New order</LinkButton>} description={`${sales.length} ${sales.length === 1 ? "sale" : "sales"}`} title="All sales" />
    {sales.length === 0 ? <EmptyState description="Sales appear here when you record a customer order." icon={<ShoppingCart size={22} aria-hidden="true" />} title="No sales yet" /> : <SalesTable money={money} sales={sales} />}
  </DashboardShell>;
}
