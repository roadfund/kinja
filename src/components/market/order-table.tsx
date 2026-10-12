import { Badge, DataTable, formatDate, type BadgeTone, type Column } from "@/components/kinja/ui";
import { moneyColumns } from "@/components/kinja/money";
import { OrderActions } from "@/components/market/order-actions";
import { moneyItem, type MoneyContext } from "@/domain/currency";
import type { OrderStatus } from "@/domain/model";
import { formatQuantity, toThousandths } from "@/domain/money";
import { orderCategoryLabels, orderChannelLabels, orderMoment, orderStatusLabels, type OrderRow } from "@/market/orders";

const statusTones: Record<OrderStatus, BadgeTone> = { DELIVERED: "green", PENDING: "amber", CANCELLED: "grey" };
const day = (date: string) => formatDate(`${date}T00:00:00.000Z`);

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={statusTones[status]}>{orderStatusLabels[status]}</Badge>;
}

function skuColumns(orders: OrderRow[]): Array<Column<OrderRow>> {
  const skus = new Map<string, OrderRow["lines"][number]["unit"]>();
  for (const order of orders) for (const line of order.lines) skus.set(line.productName, line.unit);
  return [...skus].sort(([a], [b]) => a.localeCompare(b)).map(([sku, unit]) => ({
    header: sku,
    align: "right" as const,
    cell: (order: OrderRow) => {
      const thousandths = order.lines.filter((line) => line.productName === sku).reduce((sum, line) => sum + toThousandths(line.quantity), 0);
      return thousandths ? formatQuantity(thousandths, unit) : "—";
    },
  }));
}

// Orders, one value per column. Distributors get a "⋯" menu on pending orders.
export function OrderTable({ orders, money, showDistributor = false, actions = false, today, deliveredByNames = [] }: { orders: OrderRow[]; money: MoneyContext; showDistributor?: boolean; actions?: boolean; today?: string; deliveredByNames?: string[] }) {
  const item = (minor: number) => (order: OrderRow) => moneyItem(minor, order.currency, orderMoment(order));
  const columns: Array<Column<OrderRow>> = [
    { header: "Order", cell: (order) => <span className="font-semibold text-[var(--kinja-green)]">{order.label}</span> },
    { header: "Date", cell: (order) => day(order.orderedOn) },
    ...(showDistributor ? [{ header: "Distributor", cell: (order: OrderRow) => order.distributorName }] : []),
    { header: "Customer", cell: (order) => <span className="font-medium text-[#344e41]">{order.customerName}</span> },
    { header: "Category", cell: (order) => orderCategoryLabels[order.category] },
    { header: "Channel", cell: (order) => orderChannelLabels[order.channel] },
    // One column per SKU with the quantity ordered, so a multi-SKU order never stacks values.
    ...skuColumns(orders),
    ...moneyColumns(money, "Value", (order: OrderRow) => item(order.valueMinor)(order)),
    { header: "Discount", align: "right", cell: (order) => order.discountBasisPoints ? `${order.discountBasisPoints / 100}%` : "—" },
    ...moneyColumns(money, "Payment", (order: OrderRow) => item(order.paymentMinor)(order), { strong: true }),
    { header: "Delivered by", cell: (order) => order.deliveredBy ?? "—" },
    { header: "Delivery date", cell: (order) => order.deliveredOn ? day(order.deliveredOn) : "—" },
    { header: "Status", cell: (order) => <OrderStatusBadge status={order.status} /> },
    { header: "Invoice", cell: (order) => order.invoiceLabels[0] ?? "—" },
    ...(orders.some((order) => order.cancelReason) ? [{ header: "Cancellation reason", cell: (order: OrderRow) => order.cancelReason ?? "—" }] : []),
    ...(actions ? [{ header: "", align: "right" as const, cell: (order: OrderRow) => order.status === "PENDING" ? <OrderActions deliveredBy={order.deliveredBy} deliveredByNames={deliveredByNames} label={order.label} orderedOn={order.orderedOn} orderId={order.id} today={today!} /> : null }] : []),
  ];
  return <DataTable columns={columns} muted={(order) => order.status === "CANCELLED"} rowKey={(order) => order.id} rows={orders} />;
}
