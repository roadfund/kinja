import { ShoppingCart } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, EmptyState, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { SalesTable } from "@/components/market/market-tables";
import { ExportLinks } from "@/components/ops/export-links";
import { getMoneyContext } from "@/admin/exchange-rates";
import { MoneyCards } from "@/components/kinja/money";
import { formatIn, moneyItem } from "@/domain/currency";
import { listCustomers, listInvoices, listSales, saleNetMinor, type SaleRow } from "@/market/market-service";
import { MarketTabs } from "../tabs";

export default async function HubSalesPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const [customers, sales, invoices, money] = await Promise.all([listCustomers(account), listSales(account), listInvoices(account), getMoneyContext(account.hub!)]);
  const live = sales.filter((sale) => !sale.voidedAt);
  const uninvoiced = live.filter((sale) => sale.invoiceable);
  const items = (rows: SaleRow[]) => rows.map((sale) => moneyItem(saleNetMinor(sale), sale.currency, sale.soldAt));
  const thisMonth = new Date().toISOString().slice(0, 7);
  return <DashboardShell actions={<ExportLinks datasets={["sales"]} />} eyebrow="Kinja Market" title="Sales" description="Every sale by your distributors, traced to the batch it came from.">
    <MarketTabs active="Sales" counts={{ customers: customers.length, sales: sales.length, invoices: invoices.length }} />
    <SummaryGrid>
      <SummaryCard detail={`${live.filter((sale) => sale.soldAt.startsWith(thisMonth)).length} this month`} label="Sales" value={live.length} />
      <MoneyCards detail="All recorded sales" label="Sales value" context={money} value={items(live)} />
      <SummaryCard detail="Selling in your hub" label="Distributors" value={new Set(live.map((sale) => sale.distributorId)).size} />
      <SummaryCard detail={formatIn(money, items(uninvoiced), money.primary)} label="Not invoiced" tone={uninvoiced.length ? "warning" : undefined} value={uninvoiced.length} />
    </SummaryGrid>
    {sales.length === 0 ? <EmptyState description="Sales recorded by your distributors appear here." icon={<ShoppingCart size={22} aria-hidden="true" />} title="No sales yet" /> : <SalesTable money={money} sales={sales} showDistributor />}
  </DashboardShell>;
}
