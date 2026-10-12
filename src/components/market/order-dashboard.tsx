import { ChartCard, ColumnChart, compactNumber, GREEN, GREEN_LIGHT, HBarChart, RED, StackedBarChart, type BarDatum, type ColumnDatum } from "@/components/charts/charts";
import { bodyCell, headCell, SummaryCard, SummaryGrid, tableClass, tableFrame } from "@/components/kinja/ui";
import type { ProductUnit } from "@/domain/model";
import { moneyCells, MoneyCards, moneyHeaders } from "@/components/kinja/money";
import { convertMinor, formatIn, moneyItem, totalIn, type MoneyItem } from "@/domain/currency";
import { formatQuantity } from "@/domain/money";
import { orderCategoryLabels, orderChannelLabels, orderMoment, orderStatuses, orderStatusLabels, type OrderDashboard, type OrderTotals } from "@/market/orders";
import { cn } from "@/lib/utils";
import { OrderFilters as OrderFilterControls } from "@/components/market/order-filters";

export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
// Mixed units (kg and bags) cannot be added up meaningfully, so totals then show the bare number.
export const formatAmount = (thousandths: number, unit: ProductUnit | null) => unit ? formatQuantity(thousandths, unit) : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(thousandths / 1000);
const percent = (part: number, whole: number) => whole === 0 ? "—" : `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format((part / whole) * 100)}%`;

// A compact report table: header row, body rows and a bold total row. Same look as every other
// table: one value per cell, first column pinned, scrolling sideways on narrow screens.
export function ReportTable({ headers, rows, total, className }: { headers: string[]; rows: React.ReactNode[][]; total?: React.ReactNode[]; className?: string }) {
  return <div className={cn(tableFrame, className)}>
    <table className={tableClass}>
      <thead><tr>{headers.map((header, index) => <th className={cn(headCell, index > 0 && "text-right")} key={`${header}-${index}`} scope="col">{header}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr className="group" key={rowIndex}>{row.map((cell, index) => <td className={cn(bodyCell, "tabular-nums", index === 0 ? "font-medium text-[#344e41]" : "text-right")} key={index}>{cell}</td>)}</tr>)}</tbody>
      {total && <tfoot><tr>{total.map((cell, index) => <td className={cn(bodyCell, "border-b-0 border-t-2 border-t-[#dce2d9] bg-[#f7f9f5] font-semibold tabular-nums text-[var(--kinja-green)]", index > 0 && "text-right")} key={index}>{cell}</td>)}</tr></tfoot>}
    </table>
  </div>;
}

// The period and distributor filter for a dashboard (applies in place, see order-filters.tsx).
export function OrderFilters({ dashboard }: { dashboard: OrderDashboard }) {
  return <OrderFilterControls currencies={dashboard.money.currencies} currency={dashboard.filters.currency} distributorId={dashboard.filters.distributorId} distributors={dashboard.distributors} month={dashboard.filters.month} periods={dashboard.months} year={dashboard.filters.year} />;
}

// Delivered sales per month (or per day when one month is chosen), with empty periods kept so
// gaps show as gaps. A chosen year always shows January to December.
function salesTimeline(dashboard: OrderDashboard, currency: string, amount: (thousandths: number) => string): Array<ColumnDatum & { orders: number; quantity: number; items: MoneyItem[] }> {
  const { year, month } = dashboard.filters;
  const delivered = dashboard.orders.filter((order) => order.status === "DELIVERED");
  const keyOf = (date: string) => (month ? date.slice(0, 10) : date.slice(0, 7));
  let keys: string[];
  if (year && month) {
    const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    keys = Array.from({ length: days }, (_, index) => `${year}-${month}-${String(index + 1).padStart(2, "0")}`);
  } else if (year) {
    keys = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  } else {
    const seen = delivered.map((order) => keyOf(order.orderedOn)).sort();
    keys = [];
    if (seen.length) for (let cursor = new Date(`${seen[0]}-01T00:00:00Z`); keyOf(cursor.toISOString()) <= seen[seen.length - 1]; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) keys.push(keyOf(cursor.toISOString()));
  }
  const context = dashboard.money;
  return keys.map((key) => {
    const orders = delivered.filter((order) => keyOf(order.orderedOn) === key);
    const items = orders.map((order) => moneyItem(order.paymentMinor, order.currency, orderMoment(order)));
    const minor = items.reduce((sum, item) => sum + (convertMinor(context, item, currency) ?? 0), 0);
    const quantity = orders.reduce((sum, order) => sum + order.quantityThousandths, 0);
    const date = new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);
    const title = month ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    // Three-letter months ("Sep", not "Sept") keep axis labels short.
    const axisLabel = month ? String(date.getUTCDate()) : year ? date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
    return { key, axisLabel, value: minor, orders: orders.length, quantity, items, tip: { title, rows: [[`Payment (${currency})`, formatIn(context, items, currency)], ["Orders", String(orders.length)], ["Quantity", amount(quantity)]] } };
  });
}

// The order and sales report the hub kept in its spreadsheet: orders by status, sales by SKU,
// quantity ordered by SKU and status, and delivered sales by customer category and channel.
export function OrderDashboardView({ dashboard }: { dashboard: OrderDashboard }) {
  const { summary, money: context } = dashboard;
  const { byStatus, total, unit } = summary;
  const moneyHead = (header: string) => moneyHeaders(context, header);
  // Value and payment items are pushed in pairs, so their difference is each order's discount.
  const discounts = (totals: OrderTotals) => totals.value.map((item, index) => ({ ...item, minor: item.minor - totals.payment[index].minor }));
  const amount = (thousandths: number, rowUnit: ProductUnit | null = unit) => formatAmount(thousandths, rowUnit);
  // Averages read better to one decimal place (38.7 units, not 38.658).
  const average = (totals: OrderTotals) => totals.orders ? amount(Math.round(totals.quantityThousandths / totals.orders / 100) * 100) : "—";
  const delivered = byStatus.DELIVERED;
  const currency = dashboard.filters.currency;
  // Charts use one currency; tables below them still show every currency.
  const inCurrency = (value: MoneyItem[]) => totalIn(context, value, currency) ?? 0;
  const money = (value: MoneyItem[]) => formatIn(context, value, currency);
  const statusRows = [{ status: "DELIVERED" as const, color: GREEN }, { status: "PENDING" as const, color: GREEN_LIGHT }, { status: "CANCELLED" as const, color: RED }].map((row) => ({ ...row, label: orderStatusLabels[row.status], totals: byStatus[row.status] }));
  const groupBars = (groups: Array<{ label: string; totals: OrderTotals }>): BarDatum[] => groups.filter((group) => group.totals.orders > 0).sort((a, b) => inCurrency(b.totals.payment) - inCurrency(a.totals.payment)).map(({ label, totals }) => ({ label, value: inCurrency(totals.payment), display: `${money(totals.payment)} · ${percent(inCurrency(totals.payment), inCurrency(delivered.payment))}`, tip: { title: label, rows: [["Payment value", money(totals.payment)], ["Orders", String(totals.orders)], ["Quantity", amount(totals.quantityThousandths)]] } }));
  const timeline = salesTimeline(dashboard, currency, amount);
  const { year, month } = dashboard.filters;
  const scope = year && month ? monthLabel(`${year}-${month}`) : year ?? "All time";

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--kinja-green)]">Sales dashboard</p><h2 className="mt-2 text-2xl font-semibold text-[var(--kinja-green)]">Orders and sales · {scope}</h2></div><OrderFilters dashboard={dashboard} /></div>
    {total.orders === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-sm text-[#5d685e]">No orders {year ? "in this period" : "yet"}. Orders recorded by distributors appear here.</p> : <>
      <div className="mt-6"><SummaryGrid>
        <SummaryCard detail={`${percent(delivered.orders, total.orders)} delivered · ${byStatus.PENDING.orders} pending`} label="Orders" value={total.orders} />
        <MoneyCards detail="Delivered orders, before discounts" label="Order value" context={context} value={delivered.value} />
        <MoneyCards context={context} detail={(currency) => `${formatIn(context, discounts(delivered), currency)} in discounts`} label="Payment value" value={delivered.payment} />
        <SummaryCard detail={`Average ${average(delivered)} per order`} label="Delivered" value={amount(delivered.quantityThousandths)} />
      </SummaryGrid></div>

      {/* Charts in one green on white; each keeps its numbers one tap away in "View as table". */}
      <div className="mt-8 grid gap-4 xl:grid-cols-2">
        <ChartCard className="xl:col-span-2" description={`Payment value of delivered orders, in ${currency}${month ? ", by day" : ", by month"}.`} table={<ReportTable headers={[month ? "Day" : "Month", "Orders", "Quantity", `Payment value (${currency})`]} rows={timeline.map((point) => [point.tip.title, point.orders, amount(point.quantity), money(point.items)])} />} title="Sales over time">
          <ColumnChart data={timeline} empty="No sales in this period." formatTick={(value) => value === 0 ? "0" : compactNumber(value / 100)} peakLabel={(value) => `${currency} ${compactNumber(value / 100)}`} />
        </ChartCard>

        <ChartCard description="Every order, by where it stands." legend={statusRows.map((row) => ({ label: row.label, color: row.color }))} table={<ReportTable headers={["", ...statusRows.map((row) => row.label), "Total"]} rows={[
          ["Number of orders", ...statusRows.map((row) => row.totals.orders), total.orders],
          ["Share of orders", ...statusRows.map((row) => percent(row.totals.orders, total.orders)), "100%"],
          ...context.currencies.map((code) => [`Value of orders (${code})`, ...statusRows.map((row) => formatIn(context, row.totals.value, code)), formatIn(context, total.value, code)]),
          ...context.currencies.map((code) => [`Payment value (${code})`, ...statusRows.map((row) => formatIn(context, row.totals.payment, code)), formatIn(context, total.payment, code)]),
          ["Quantity", ...statusRows.map((row) => amount(row.totals.quantityThousandths)), amount(total.quantityThousandths)],
          ["Average per order", ...statusRows.map((row) => average(row.totals)), average(total)],
        ]} />} title="Total orders">
          <HBarChart data={statusRows.map((row) => ({ label: row.label, value: row.totals.orders, color: row.color, display: `${row.totals.orders} · ${percent(row.totals.orders, total.orders)}`, tip: { title: row.label, rows: [["Orders", String(row.totals.orders)], ["Share", percent(row.totals.orders, total.orders)], [`Value (${currency})`, money(row.totals.value)], [`Payment (${currency})`, money(row.totals.payment)], ["Quantity", amount(row.totals.quantityThousandths)], ["Average per order", average(row.totals)]] } }))} />
        </ChartCard>

        <ChartCard description={`Delivered orders, payment value in ${currency}.`} table={<ReportTable headers={["SKU", "Quantity", ...moneyHead("Order value"), ...moneyHead("Payment value")]} rows={summary.skus.map((sku) => [sku.name, amount(sku.quantity.DELIVERED, sku.unit), ...moneyCells(context, sku.deliveredValue), ...moneyCells(context, sku.deliveredPayment)])} total={["Total", amount(delivered.quantityThousandths), ...moneyCells(context, delivered.value), ...moneyCells(context, delivered.payment)]} />} title="Sales by SKU">
          <HBarChart data={[...summary.skus].sort((a, b) => inCurrency(b.deliveredPayment) - inCurrency(a.deliveredPayment)).map((sku) => ({ label: sku.name, value: inCurrency(sku.deliveredPayment), display: money(sku.deliveredPayment), tip: { title: sku.name, rows: [["Payment value", money(sku.deliveredPayment)], ["Order value", money(sku.deliveredValue)], ["Quantity", amount(sku.quantity.DELIVERED, sku.unit)]] } }))} />
        </ChartCard>

        <ChartCard description={`Delivered orders, payment value in ${currency}.`} table={<ReportTable headers={["Category", "Orders", "Quantity", ...moneyHead("Payment value")]} rows={summary.byCategory.map(({ key, totals }) => [orderCategoryLabels[key], totals.orders, amount(totals.quantityThousandths), ...moneyCells(context, totals.payment)])} total={["Total", delivered.orders, amount(delivered.quantityThousandths), ...moneyCells(context, delivered.payment)]} />} title="Sales by customer category">
          <HBarChart data={groupBars(summary.byCategory.map(({ key, totals }) => ({ label: orderCategoryLabels[key], totals })))} />
        </ChartCard>

        <ChartCard description={`Delivered orders, payment value in ${currency}.`} table={<ReportTable headers={["Channel", "Orders", "Quantity", ...moneyHead("Payment value")]} rows={summary.byChannel.map(({ key, totals }) => [orderChannelLabels[key], totals.orders, amount(totals.quantityThousandths), ...moneyCells(context, totals.payment)])} total={["Total", delivered.orders, amount(delivered.quantityThousandths), ...moneyCells(context, delivered.payment)]} />} title="Sales by ordering channel">
          <HBarChart data={groupBars(summary.byChannel.map(({ key, totals }) => ({ label: orderChannelLabels[key], totals })))} empty="No delivered orders yet." />
        </ChartCard>

        <ChartCard className="xl:col-span-2" description="All orders, including pending and cancelled." legend={statusRows.map((row) => ({ label: row.label, color: row.color }))} table={<ReportTable headers={["SKU", ...orderStatuses.map((status) => orderStatusLabels[status]), "Total", "Share"]} rows={summary.skus.map((sku) => [sku.name, ...orderStatuses.map((status) => amount(sku.quantity[status], sku.unit)), amount(sku.totalThousandths, sku.unit), percent(sku.totalThousandths, total.quantityThousandths)])} total={["Total", ...orderStatuses.map((status) => amount(byStatus[status].quantityThousandths)), amount(total.quantityThousandths), "100%"]} />} title="Quantity ordered by SKU">
          <StackedBarChart data={summary.skus.map((sku) => ({ label: sku.name, total: sku.totalThousandths, display: `${amount(sku.totalThousandths, sku.unit)} · ${percent(sku.totalThousandths, total.quantityThousandths)}`, parts: statusRows.map((row) => ({ value: sku.quantity[row.status], color: row.color })), tip: { title: sku.name, rows: [...statusRows.map((row): [string, string] => [row.label, amount(sku.quantity[row.status], sku.unit)]), ["Total", amount(sku.totalThousandths, sku.unit)], ["Share of all units", percent(sku.totalThousandths, total.quantityThousandths)]] } }))} />
        </ChartCard>
      </div>
    </>}
  </section>;
}
