import { z } from "zod";
import { requireOrganizationScope, requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { countries } from "@/config/countries";
import { getMoneyContext } from "@/admin/exchange-rates";
import { moneyItem, type MoneyContext, type MoneyItem } from "@/domain/currency";
import { createUuidV7 } from "@/domain/id";
import { amountForWeight, toThousandths } from "@/domain/money";
import { OrderCategory, OrderChannel, Quantity, type Hub, type Order, type OrderStatus, type ProductUnit, type Sale } from "@/domain/model";
import { batchLabel } from "@/manufacture/manufacture-service";
import { distributorStock, hubCurrency, invoiceLabel, orderLabel } from "@/market/market-service";
import { writeAuditLog } from "@/ops/audit";
import { getRepository } from "@/repositories/server";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const orderStatuses = ["DELIVERED", "PENDING", "CANCELLED"] as const satisfies readonly OrderStatus[];
export const orderStatusLabels: Record<OrderStatus, string> = { DELIVERED: "Delivered", PENDING: "Pending", CANCELLED: "Cancelled" };
export const orderCategoryLabels: Record<OrderCategory, string> = { RETAIL: "Retail", WHOLESALE: "Wholesale", SAMPLE: "Sample" };
export const orderChannelLabels: Record<OrderChannel, string> = { PHONE: "Phone", WHATSAPP: "WhatsApp", TEAM_MEMBER: "Team member", OFFICE_WALK_IN: "Office walk-in", IN_PERSON: "In person", POP_UP_SHOP: "Pop-up shop", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", OTHER: "Other" };

// Today's date in the hub's time zone, as YYYY-MM-DD.
export function hubToday(hub: Pick<Hub, "countryId">, now = new Date()): string {
  const timeZone = countries.find((country) => country.id === hub.countryId)?.timeZone ?? "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// ---- Creating and updating orders -------------------------------------------

export const OrderLineInput = z.object({
  batchId: z.string().min(1),
  quantity: Quantity.refine((value) => toThousandths(value) > 0, "Must be more than 0"),
  unitPriceMinor: z.number().int().nonnegative(),
});

export const OrderInput = z.object({
  customerId: z.string().min(1),
  orderedOn: z.string().date(),
  // Optional for older clients: defaults to the hub's main currency.
  currency: z.string().length(3).optional(),
  category: OrderCategory,
  channel: OrderChannel,
  deliveredBy: optionalText(120),
  // Percent with up to 2 decimals, stored as basis points so it stays exact.
  discountBasisPoints: z.number().int().min(0).max(10_000).default(0),
  delivered: z.boolean().default(false),
  lines: z.array(OrderLineInput).min(1, "Add at least one product").max(20),
});

// Splits an order discount across its lines so the parts add up to the whole.
export function splitDiscount(amounts: number[], basisPoints: number): number[] {
  const gross = amounts.reduce((sum, amount) => sum + amount, 0);
  const total = Math.round((gross * basisPoints) / 10_000);
  const parts = amounts.map((amount) => (gross === 0 ? 0 : Math.floor((total * amount) / gross)));
  let remainder = total - parts.reduce((sum, part) => sum + part, 0);
  for (let index = 0; remainder > 0; index = (index + 1) % parts.length) {
    if (parts[index] < amounts[index]) {
      parts[index] += 1;
      remainder -= 1;
    }
  }
  return parts;
}

// An order is one sale per line, all checked against the distributor's stock first.
export async function createOrder(account: Account, input: unknown, now = new Date()): Promise<{ order: Order; sales: Sale[] }> {
  const scope = requireOrganizationScope(account, ["DISTRIBUTOR"], "DISTRIBUTOR");
  const details = OrderInput.parse(input);
  const repository = getRepository();
  if (details.orderedOn > hubToday(account.hub!, now)) throw new Error("The order date cannot be in the future");
  const customer = await repository.get("Customer", details.customerId, scope.hubId);
  if (!customer || customer.archivedAt) throw new Error("Choose an active customer");

  const stock = await distributorStock(scope.hubId, scope.organizationId);
  const wanted = new Map<string, number>();
  for (const line of details.lines) wanted.set(line.batchId, (wanted.get(line.batchId) ?? 0) + toThousandths(line.quantity));
  for (const [batchId, thousandths] of wanted) {
    const row = stock.find((item) => item.batchId === batchId);
    if (!row) throw new Error("You have no stock from one of the chosen batches");
    if (thousandths > row.availableThousandths) throw new Error(`You cannot order more ${row.productName} (${row.batchLabel}) than you have in stock`);
  }

  const timestamp = now.toISOString();
  const currency = details.currency ?? hubCurrency(account.hub!);
  const { currencies } = await getMoneyContext(account.hub!);
  if (!currencies.includes(currency)) throw new Error(`Orders in this hub can be in ${currencies.join(" or ")}`);
  const number = (await repository.list("Order", scope.hubId)).reduce((max, order) => Math.max(max, order.number), 0) + 1;
  const order: Order = { id: createUuidV7(), hubId: scope.hubId, distributorId: scope.organizationId, number, customerId: customer.id, orderedOn: details.orderedOn, category: details.category, channel: details.channel, status: details.delivered ? "DELIVERED" : "PENDING", discountBasisPoints: details.discountBasisPoints, deliveredBy: details.deliveredBy, deliveredOn: details.delivered ? details.orderedOn : undefined, currency, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  // Orders entered after the fact keep the order date, so reports land in the right month.
  const soldAt = details.orderedOn === hubToday(account.hub!, now) ? timestamp : `${details.orderedOn}T12:00:00.000Z`;
  const amounts = details.lines.map((line) => amountForWeight(line.quantity, line.unitPriceMinor));
  const discounts = splitDiscount(amounts, details.discountBasisPoints);
  const sales: Sale[] = details.lines.map((line, index) => {
    const row = stock.find((item) => item.batchId === line.batchId)!;
    return { id: createUuidV7(), hubId: scope.hubId, distributorId: scope.organizationId, customerId: customer.id, productId: row.productId, batchId: row.batchId, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor, amountMinor: amounts[index], discountMinor: discounts[index] || undefined, currency, soldAt, orderId: order.id, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  });
  await repository.put("Order", order);
  for (const sale of sales) await repository.put("Sale", sale);
  return { order, sales };
}

async function ownPendingOrder(account: Account, orderId: string) {
  const scope = requireOrganizationScope(account, ["DISTRIBUTOR"], "DISTRIBUTOR");
  const order = await getRepository().get("Order", orderId, scope.hubId);
  if (!order || order.distributorId !== scope.organizationId) throw new Error("Order not found");
  if (order.status !== "PENDING") throw new Error(`This order is already ${orderStatusLabels[order.status].toLowerCase()}`);
  return { scope, order };
}

export const DeliverOrderInput = z.object({ deliveredOn: z.string().date(), deliveredBy: optionalText(120) });

export async function markOrderDelivered(account: Account, orderId: string, input: unknown, now = new Date()): Promise<Order> {
  const { order } = await ownPendingOrder(account, orderId);
  const details = DeliverOrderInput.parse(input);
  if (details.deliveredOn < order.orderedOn) throw new Error("Delivery cannot be before the order date");
  if (details.deliveredOn > hubToday(account.hub!, now)) throw new Error("The delivery date cannot be in the future");
  const updated: Order = { ...order, status: "DELIVERED", deliveredOn: details.deliveredOn, deliveredBy: details.deliveredBy ?? order.deliveredBy, updatedAt: now.toISOString() };
  await getRepository().put("Order", updated);
  return updated;
}

export const CancelOrderInput = z.object({ reason: z.string().trim().min(3).max(500) });

// Only pending orders can be cancelled. Their sales are voided (never deleted), which frees the stock.
export async function cancelOrder(account: Account, orderId: string, input: unknown, now = new Date()): Promise<Order> {
  const { scope, order } = await ownPendingOrder(account, orderId);
  const { reason } = CancelOrderInput.parse(input);
  const repository = getRepository();
  const timestamp = now.toISOString();
  for (const sale of (await repository.list("Sale", scope.hubId)).filter((item) => item.orderId === order.id && !item.voidedAt)) {
    await repository.put("Sale", { ...sale, voidedAt: timestamp, voidedById: scope.userId, voidReason: `Order cancelled: ${reason}`, updatedAt: timestamp });
  }
  const updated: Order = { ...order, status: "CANCELLED", cancelledAt: timestamp, cancelledById: scope.userId, cancelReason: reason, updatedAt: timestamp };
  await repository.put("Order", updated);
  await writeAuditLog({ actorId: scope.userId, hubId: scope.hubId, action: "CANCEL", entity: "Order", entityId: order.id, reason }, now);
  return updated;
}

// ---- Reading orders ---------------------------------------------------------

// A period is a year ("2021") or a month of a year (year "2021", month "03").
export type OrderFilters = { year?: string; month?: string; distributorId?: string; currency?: string };
export type OrderLine = { saleId: string; productId: string; productName: string; unit: ProductUnit; batchLabel: string; quantity: string; unitPriceMinor: number; amountMinor: number; discountMinor: number };
export type OrderRow = Order & { label: string; customerName: string; distributorName: string; lines: OrderLine[]; valueMinor: number; paymentMinor: number; quantityThousandths: number; invoiceLabels: string[] };

// "2021" or "2021-03": what orderedOn must start with. A month without a year is ignored.
export function periodPrefix({ year, month }: Pick<OrderFilters, "year" | "month">): string | undefined {
  if (!year || !/^\d{4}$/.test(year)) return undefined;
  return month && /^(0[1-9]|1[0-2])$/.test(month) ? `${year}-${month}` : year;
}

export async function listOrders(account: Account, filters: OrderFilters = {}): Promise<OrderRow[]> {
  const scope = requireRole(account, ["HUB_ADMIN", "DISTRIBUTOR"]);
  const repository = getRepository();
  const [orders, sales, customers, products, batches, invoices, organizations] = await Promise.all([repository.list("Order", scope.hubId), repository.list("Sale", scope.hubId), repository.list("Customer", scope.hubId), repository.list("Product", scope.hubId), repository.list("Batch", scope.hubId), repository.list("Invoice", scope.hubId), repository.list("Organization", scope.hubId)]);
  const distributorId = scope.role === "HUB_ADMIN" ? filters.distributorId : scope.organizationId;
  const period = periodPrefix(filters);
  return orders.filter((order) => (!distributorId || order.distributorId === distributorId) && (!period || order.orderedOn.startsWith(period))).map((order) => {
    // A cancelled order keeps its voided lines so cancelled quantities can be reported.
    const lines = sales.filter((sale) => sale.orderId === order.id && (order.status === "CANCELLED" || !sale.voidedAt)).map((sale): OrderLine => {
      const product = products.find((item) => item.id === sale.productId);
      const batch = batches.find((item) => item.id === sale.batchId);
      return { saleId: sale.id, productId: sale.productId, productName: product?.name ?? "Product", unit: product?.unit ?? "KG", batchLabel: batch ? batchLabel(batch) : "—", quantity: sale.quantity, unitPriceMinor: sale.unitPriceMinor, amountMinor: sale.amountMinor, discountMinor: sale.discountMinor ?? 0 };
    });
    const valueMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
    const invoiceIds = new Set(sales.filter((sale) => sale.orderId === order.id && sale.invoiceId).map((sale) => sale.invoiceId));
    return { ...order, label: orderLabel(order), customerName: customers.find((item) => item.id === order.customerId)?.name ?? "Customer", distributorName: organizations.find((item) => item.id === order.distributorId)?.name ?? "", lines, valueMinor, paymentMinor: valueMinor - lines.reduce((sum, line) => sum + line.discountMinor, 0), quantityThousandths: lines.reduce((sum, line) => sum + toThousandths(line.quantity), 0), invoiceLabels: invoices.filter((invoice) => invoiceIds.has(invoice.id) && !invoice.voidedAt).map(invoiceLabel) };
  }).sort((a, b) => b.orderedOn.localeCompare(a.orderedOn) || b.number - a.number);
}

// ---- The sales dashboard (the same tables as the hub's order spreadsheet) ---

// Money is kept as recorded items (amount, currency, date) so totals can be shown in every currency.
export type OrderTotals = { orders: number; value: MoneyItem[]; payment: MoneyItem[]; quantityThousandths: number };
export type SkuSummary = { productId: string; name: string; unit: ProductUnit; quantity: Record<OrderStatus, number>; totalThousandths: number; deliveredValue: MoneyItem[]; deliveredPayment: MoneyItem[] };
export type GroupSummary<K extends string> = { key: K; totals: OrderTotals };
export type OrderSummary = { byStatus: Record<OrderStatus, OrderTotals>; total: OrderTotals; skus: SkuSummary[]; byCategory: Array<GroupSummary<OrderCategory>>; byChannel: Array<GroupSummary<OrderChannel>>; unit: ProductUnit | null };

const emptyTotals = (): OrderTotals => ({ orders: 0, value: [], payment: [], quantityThousandths: 0 });
export const orderMoment = (order: Pick<Order, "orderedOn">) => `${order.orderedOn}T12:00:00.000Z`;
function add(totals: OrderTotals, row: OrderRow) {
  totals.orders += 1;
  totals.value.push(moneyItem(row.valueMinor, row.currency, orderMoment(row)));
  totals.payment.push(moneyItem(row.paymentMinor, row.currency, orderMoment(row)));
  totals.quantityThousandths += row.quantityThousandths;
}

// Sales by SKU, category and channel count delivered orders only, as in the spreadsheet.
export function summarizeOrders(rows: OrderRow[]): OrderSummary {
  const byStatus = { DELIVERED: emptyTotals(), PENDING: emptyTotals(), CANCELLED: emptyTotals() };
  const total = emptyTotals();
  const skus = new Map<string, SkuSummary>();
  const byCategory = new Map(OrderCategory.options.map((key) => [key, emptyTotals()]));
  const byChannel = new Map(OrderChannel.options.map((key) => [key, emptyTotals()]));
  const units = new Set<ProductUnit>();
  for (const row of rows) {
    add(byStatus[row.status], row);
    add(total, row);
    if (row.status === "DELIVERED") {
      add(byCategory.get(row.category)!, row);
      add(byChannel.get(row.channel)!, row);
    }
    for (const line of row.lines) {
      units.add(line.unit);
      const sku = skus.get(line.productId) ?? { productId: line.productId, name: line.productName, unit: line.unit, quantity: { DELIVERED: 0, PENDING: 0, CANCELLED: 0 }, totalThousandths: 0, deliveredValue: [], deliveredPayment: [] };
      const thousandths = toThousandths(line.quantity);
      sku.quantity[row.status] += thousandths;
      sku.totalThousandths += thousandths;
      if (row.status === "DELIVERED") {
        sku.deliveredValue.push(moneyItem(line.amountMinor, row.currency, orderMoment(row)));
        sku.deliveredPayment.push(moneyItem(line.amountMinor - line.discountMinor, row.currency, orderMoment(row)));
      }
      skus.set(line.productId, sku);
    }
  }
  return {
    byStatus,
    total,
    skus: [...skus.values()].sort((a, b) => b.totalThousandths - a.totalThousandths || a.name.localeCompare(b.name)),
    byCategory: [...byCategory].map(([key, totals]) => ({ key, totals })),
    byChannel: [...byChannel].map(([key, totals]) => ({ key, totals })).filter((group) => group.totals.orders > 0),
    unit: units.size === 1 ? [...units][0] : null,
  };
}

export type OrderDashboard = { currency: string; money: MoneyContext; filters: { year?: string; month?: string; distributorId?: string; currency: string }; months: string[]; distributors: Array<{ id: string; name: string }>; orders: OrderRow[]; summary: OrderSummary };

export async function orderDashboard(account: Account, filters: OrderFilters = {}): Promise<OrderDashboard> {
  const scope = requireRole(account, ["HUB_ADMIN", "DISTRIBUTOR"]);
  const all = await listOrders(account, { distributorId: filters.distributorId });
  const period = periodPrefix(filters);
  const orders = period ? all.filter((order) => order.orderedOn.startsWith(period)) : all;
  const distributors = scope.role === "HUB_ADMIN" ? (await getRepository().list("Organization", scope.hubId)).filter((org) => org.type === "DISTRIBUTOR").map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const money = await getMoneyContext(account.hub!);
  // Charts show one currency at a time: the one asked for, else the one most orders were recorded in.
  const recorded = new Map<string, number>();
  for (const order of orders) recorded.set(order.currency, (recorded.get(order.currency) ?? 0) + 1);
  const usual = [...recorded].sort((a, b) => b[1] - a[1])[0]?.[0];
  const currency = [filters.currency, usual, money.primary].find((code): code is string => Boolean(code && money.currencies.includes(code)))!;
  return { currency: hubCurrency(account.hub!), money, filters: { currency, year: period?.slice(0, 4), month: period?.slice(5, 7) || undefined, distributorId: scope.role === "HUB_ADMIN" && distributors.some((item) => item.id === filters.distributorId) ? filters.distributorId : undefined }, months: [...new Set(all.map((order) => order.orderedOn.slice(0, 7)))].sort().reverse(), distributors, orders, summary: summarizeOrders(orders) };
}
