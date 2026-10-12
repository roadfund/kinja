import { Package, ShoppingBag } from "lucide-react";
import { EmptyState, SectionHeader, SectionTabs, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { formatAmount, OrderFilters, ReportTable } from "@/components/market/order-dashboard";
import { OrderTable } from "@/components/market/order-table";
import type { OrderStatus, ProductUnit } from "@/domain/model";
import { moneyCells, MoneyCards, moneyHeaders } from "@/components/kinja/money";
import { formatIn, moneyItem, totalIn, type MoneyItem } from "@/domain/currency";
import { formatQuantity } from "@/domain/money";
import type { StockRow } from "@/market/market-service";
import { orderStatuses, orderStatusLabels, type OrderDashboard } from "@/market/orders";

const query = (params: Record<string, string | undefined>) => { const search = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString(); return search ? `?${search}` : ""; };

// The orders list shared by the distributor and hub pages, with status tabs and period filters.
export function OrdersView({ dashboard, basePath, status, newOrderAction, actions = false, today, deliveredByNames }: { dashboard: OrderDashboard; basePath: string; status?: OrderStatus; newOrderAction?: React.ReactNode; actions?: boolean; today?: string; deliveredByNames?: string[] }) {
  const { orders, summary, money: context, filters } = dashboard;
  const shown = status ? orders.filter((order) => order.status === status) : orders;
  const tabQuery = (tab?: OrderStatus) => `${basePath}${query({ status: tab, year: filters.year, month: filters.month, distributor: filters.distributorId })}`;
  return <>
    <SummaryGrid>
      <SummaryCard detail={`${summary.byStatus.DELIVERED.orders} delivered`} label="Orders" value={summary.total.orders} />
      <SummaryCard detail="Waiting to be delivered" label="Pending" tone={summary.byStatus.PENDING.orders ? "warning" : undefined} value={summary.byStatus.PENDING.orders} />
      <MoneyCards detail="Delivered, after discounts" label="Payment value" context={context} value={summary.byStatus.DELIVERED.payment} />
      <SummaryCard detail={`${formatIn(context, summary.byStatus.CANCELLED.value, context.primary)} not sold`} label="Cancelled" value={summary.byStatus.CANCELLED.orders} />
    </SummaryGrid>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4"><OrderFilters dashboard={dashboard} />{newOrderAction}</div>
    <div className="mt-6"><SectionTabs active={status ? orderStatusLabels[status] : "All"} tabs={[{ label: "All", href: tabQuery(), count: orders.length }, ...orderStatuses.map((tab) => ({ label: orderStatusLabels[tab], href: tabQuery(tab), count: summary.byStatus[tab].orders }))]} /></div>
    {shown.length === 0 ? <EmptyState description={status ? `No ${orderStatusLabels[status].toLowerCase()} orders in this period.` : "Orders appear here once a distributor records them."} icon={<ShoppingBag size={22} aria-hidden="true" />} title="No orders" /> : <OrderTable actions={actions} money={context} deliveredByNames={deliveredByNames} orders={shown} showDistributor={dashboard.distributors.length > 1} today={today} />}
  </>;
}

type SkuRow = { productId: string; name: string; unit: ProductUnit; stockThousandths: number; quantity: Record<OrderStatus, number>; totalThousandths: number; deliveredValue: MoneyItem[]; deliveredPayment: MoneyItem[] };

// One row per SKU (product): stock on hand and how much was ordered, delivered and paid.
export function SkuView({ dashboard, stock }: { dashboard: OrderDashboard; stock: StockRow[] }) {
  const { summary, money: context } = dashboard;
  const rows = new Map<string, SkuRow>(summary.skus.map((sku) => [sku.productId, { ...sku, stockThousandths: 0 }]));
  for (const row of stock) {
    const sku = rows.get(row.productId) ?? { productId: row.productId, name: row.productName, unit: row.unit, stockThousandths: 0, quantity: { DELIVERED: 0, PENDING: 0, CANCELLED: 0 }, totalThousandths: 0, deliveredValue: [], deliveredPayment: [] };
    sku.stockThousandths += row.availableThousandths;
    rows.set(row.productId, sku);
  }
  const skus = [...rows.values()].sort((a, b) => b.totalThousandths - a.totalThousandths || a.name.localeCompare(b.name));
  const top = summary.skus[0];
  const money = (value: MoneyItem[]) => moneyCells(context, value);
  const moneyHead = (header: string) => moneyHeaders(context, header);
  // Average price actually charged per unit, after discounts.
  const averagePrice = (sku: SkuRow) => { const paid = totalIn(context, sku.deliveredPayment, context.primary); return sku.quantity.DELIVERED && paid !== null ? money([moneyItem(Math.round((paid * 1000) / sku.quantity.DELIVERED), context.primary)]) : context.currencies.map(() => "—"); };
  return <>
    <SummaryGrid>
      <SummaryCard detail="Products ordered or in stock" label="SKUs" value={skus.length} />
      <SummaryCard detail={top ? `${formatQuantity(top.totalThousandths, top.unit)} ordered` : "No orders yet"} label="Top SKU" value={top?.name ?? "—"} />
      <SummaryCard detail="Across all SKUs" label="In stock" value={formatAmount(skus.reduce((sum, sku) => sum + sku.stockThousandths, 0), new Set(skus.map((sku) => sku.unit)).size === 1 ? skus[0].unit : null)} />
      <MoneyCards detail="Delivered, after discounts" label="Payment value" context={context} value={summary.byStatus.DELIVERED.payment} />
    </SummaryGrid>
    <div className="mt-8"><OrderFilters dashboard={dashboard} /></div>
    <SectionHeader description="Stock is what is on hand today. Ordered quantities follow the period filter." title="SKU performance" />
    {skus.length === 0 ? <EmptyState description="SKUs appear once finished goods reach a distributor." icon={<Package size={22} aria-hidden="true" />} title="No SKUs yet" /> :
      <ReportTable headers={["SKU", "In stock", ...orderStatuses.map((status) => orderStatusLabels[status]), ...moneyHead("Order value"), ...moneyHead("Payment value"), ...moneyHead("Avg. price")]} rows={skus.map((sku) => [sku.name, <span className={sku.stockThousandths === 0 ? "font-semibold text-[#9b2c1f]" : "font-semibold text-[var(--kinja-green)]"} key="stock">{formatQuantity(sku.stockThousandths, sku.unit)}</span>, ...orderStatuses.map((status) => formatQuantity(sku.quantity[status], sku.unit)), ...money(sku.deliveredValue), ...money(sku.deliveredPayment), ...averagePrice(sku)])} total={["Total", "", ...orderStatuses.map((status) => formatAmount(summary.byStatus[status].quantityThousandths, summary.unit)), ...money(summary.byStatus.DELIVERED.value), ...money(summary.byStatus.DELIVERED.payment), ...context.currencies.map(() => "")]} />}
  </>;
}
