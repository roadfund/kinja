import { createUuidV7 } from "@/domain/id";
import type { Batch, Collection, Customer, ExchangeRate, Invoice, Order, OrderCategory, OrderChannel, PaymentMethod, Product, Sale, Transfer } from "@/domain/model";
import { seedIds } from "@/dev/seed";
import { getRepository } from "@/repositories/server";

// Imports a hub's sales history from its order spreadsheet (dev tools only), so the dashboards
// can be shown with real numbers. It expects the tabs of Jimmy's Group "Sales Platform" sheet:
// one row per order line, payments, deliveries and cancellations, rates and prices, and customers.
// Records are written as they were: orders keep their own numbers (JSK0001) as the reference.

type Table = { rows: string[][]; col: (name: string, after?: number) => number };
export type ImportSummary = { orders: number; lines: number; customers: number; invoices: number; collections: number; cancelled: number; skus: string[]; rates: number; firstDate: string; lastDate: string; skipped: string[] };

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
const norm = (value: string) => clean(value).toLowerCase();

// Finds the first row holding all the given headers, and returns the rows below it.
function findTable(tabs: string[][][], headers: string[]): Table | null {
  for (const tab of tabs) {
    for (let index = 0; index < Math.min(tab.length, 10); index++) {
      const row = tab[index].map(norm);
      if (headers.every((header) => row.includes(norm(header)))) {
        return { rows: tab.slice(index + 1), col: (name, after = -1) => row.findIndex((cell, column) => column > after && cell === norm(name)) };
      }
    }
  }
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// "February 12, 2021" or "Feb 12, 2021" -> "2021-02-12".
export function parseDate(value: string | undefined): string | null {
  const match = /^([A-Za-z]{3})[A-Za-z]*\.? (\d{1,2}), (\d{4})$/.exec(clean(value));
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

// "$1,234.50" -> 123450 cents, without floats.
export function parseCents(value: string | undefined): number {
  const text = clean(value).replace(/[$,\s]/g, "");
  const match = /^(-?)(\d*)(?:\.(\d{0,2})\d*)?$/.exec(text);
  if (!match || (!match[2] && !match[3])) return 0;
  const cents = Number(match[2] || "0") * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  return match[1] ? -cents : cents;
}

// Liberian numbers become +231 followed by the local number; anything else is kept as written.
export function normalizePhone(value: string | undefined): string | undefined {
  const digits = clean(value).replace(/\D/g, "");
  if (!digits) return undefined;
  const local = digits.startsWith("231") ? digits.slice(3) : digits.replace(/^0/, "");
  return /^[5-8]\d{7,8}$/.test(local) ? `+231${local}` : clean(value);
}

const customerKey = (name: string) => norm(name).replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const categories: Record<string, OrderCategory> = { retail: "RETAIL", wholesale: "WHOLESALE", sample: "SAMPLE" };
const channels: Record<string, OrderChannel> = { phone: "PHONE", whatsapp: "WHATSAPP", "team member": "TEAM_MEMBER", "office walk-in": "OFFICE_WALK_IN", "in person": "IN_PERSON", "pop-up shop": "POP_UP_SHOP", instagram: "INSTAGRAM", facebook: "FACEBOOK" };
const methods: Record<string, PaymentMethod> = { cash: "CASH", "mtn mobilemoney": "MOBILE_MONEY", "orange money": "MOBILE_MONEY", tipme: "MOBILE_MONEY", paypal: "BANK_TRANSFER", check: "BANK_TRANSFER" };
const noon = (date: string) => `${date}T12:00:00.000Z`;

export async function importSalesHistory(tabs: string[][][], now = new Date()): Promise<ImportSummary> {
  const lines = findTable(tabs, ["Status", "Order No.", "SKU", "Quantity", "Customer Category"]);
  if (!lines) throw new Error("No tab with order lines (Status, Order No., SKU, Quantity, Customer Category) was found");
  const payments = findTable(tabs, ["Order No", "USD Payment", "LRD Payment", "Total USD Payment"]);
  const deliveries = findTable(tabs, ["Delivery Date", "Order Number", "Delivered By", "Cancellation Date"]);
  const reference = findTable(tabs, ["From", "To", "Exchange Rate"]);
  const customerList = findTable(tabs, ["Customer", "Contact", "Address", "Last Order Date"]);

  const repository = getRepository();
  const hubId = seedIds.verifiedHub;
  const memberships = await repository.list("Membership", hubId);
  const distributorUser = memberships.find((membership) => membership.organizationId === seedIds.distributor)?.userId;
  const manufacturerUser = memberships.find((membership) => membership.organizationId === seedIds.manufacturer)?.userId;
  if (!distributorUser || !manufacturerUser) throw new Error("Load the demo data first: the import needs the seeded distributor and manufacturer");
  const skipped: string[] = [];
  const audit = (by: string, at: string) => ({ createdById: by, createdAt: at, updatedAt: at });

  // ---- Order lines, grouped into orders ----
  const L = { status: lines.col("Status"), number: lines.col("Order No."), date: lines.col("Date"), name: lines.col("Name"), sku: lines.col("SKU"), quantity: lines.col("Quantity"), category: lines.col("Customer Category"), price: lines.col("SKU Price"), value: lines.col("Total Order Value (USD)"), discount: lines.col("Discount (%)"), payment: lines.col("Payment Value (USD)"), delivered: lines.col("Delivery Date"), channel: lines.col("Ordering Channel") };
  type Line = { sku: string; quantity: number; priceMinor: number; valueMinor: number; paymentMinor: number };
  type Draft = { number: string; status: string; date: string; name: string; category: OrderCategory; channel: OrderChannel; discount: number; deliveredOn?: string; lines: Line[] };
  const drafts = new Map<string, Draft>();
  for (const row of lines.rows) {
    const number = clean(row[L.number]);
    if (!/^[A-Z]+\d+$/.test(number)) continue;
    const date = parseDate(row[L.date]);
    if (!date) { skipped.push(`${number}: no valid date`); continue; }
    const draft = drafts.get(number) ?? { number, status: norm(row[L.status]), date, name: clean(row[L.name]), category: categories[norm(row[L.category])] ?? "RETAIL", channel: channels[norm(row[L.channel])] ?? "OTHER", discount: Math.round(Number(clean(row[L.discount]).replace("%", "")) * (clean(row[L.discount]).includes("%") ? 100 : 10_000)) || 0, deliveredOn: parseDate(row[L.delivered]) ?? undefined, lines: [] };
    const quantity = Number(clean(row[L.quantity]));
    if (quantity > 0 && Number.isInteger(quantity)) draft.lines.push({ sku: clean(row[L.sku]), quantity, priceMinor: parseCents(row[L.price]), valueMinor: parseCents(row[L.value]), paymentMinor: parseCents(row[L.payment]) });
    drafts.set(number, draft);
  }
  const orders = [...drafts.values()].filter((draft) => {
    if (draft.lines.length) return true;
    skipped.push(`${draft.number}: no quantities`);
    return false;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  if (orders.length === 0) throw new Error("The order lines tab has no orders with quantities");

  // ---- Deliveries (who, when) and cancellations (why) ----
  const deliveredBy = new Map<string, { by?: string; on?: string }>();
  const cancelReason = new Map<string, string>();
  if (deliveries) {
    const [on, number, by] = [deliveries.col("Delivery Date"), deliveries.col("Order Number"), deliveries.col("Delivered By")];
    const cancelledAt = deliveries.col("Cancellation Date");
    const [cancelNumber, reason] = [deliveries.col("Order Number", cancelledAt), deliveries.col("Reason for cancelling")];
    for (const row of deliveries.rows) {
      if (clean(row[number])) deliveredBy.set(clean(row[number]), { by: clean(row[by]) || undefined, on: parseDate(row[on]) ?? undefined });
      if (cancelNumber >= 0 && clean(row[cancelNumber])) cancelReason.set(clean(row[cancelNumber]), clean(row[reason]) || "Cancelled");
    }
  }

  // ---- Customers: one per distinct name, with contacts from the customer list ----
  const contacts = new Map<string, { phone?: string; address?: string }>();
  if (customerList) {
    const [name, phone, address] = [customerList.col("Customer"), customerList.col("Contact"), customerList.col("Address")];
    for (const row of customerList.rows) if (clean(row[name])) contacts.set(customerKey(row[name]), { phone: normalizePhone(row[phone]), address: clean(row[address]) || undefined });
  }
  const customers = new Map<string, Customer>();
  for (const order of orders) {
    const key = customerKey(order.name) || "walkin";
    if (customers.has(key)) continue;
    const contact = contacts.get(key);
    customers.set(key, { id: createUuidV7(), hubId, name: order.name || "Walk-in customer", phone: contact?.phone, address: contact?.address, paymentTermsDays: 0, ...audit(distributorUser, noon(order.date)) });
  }

  // ---- Products and opening stock: a batch per SKU, shipped to the distributor ----
  const skuNames = [...new Set(orders.flatMap((order) => order.lines.map((line) => line.sku)))].sort();
  const firstDate = orders[0].date;
  const stockDay = noon(firstDate);
  const existingProducts = await repository.list("Product", hubId);
  const batchNumber = (await repository.list("Batch", hubId)).filter((batch) => batch.organizationId === seedIds.manufacturer).reduce((max, batch) => Math.max(max, batch.number), 0);
  const raw: Transfer = { id: createUuidV7(), hubId, kind: "RAW_MATERIAL", fromOrganizationId: seedIds.cooperative, toOrganizationId: seedIds.manufacturer, deliveryIds: [], unit: "KG", quantitySent: "0", quantityReceived: "0", status: "RECEIVED", hasDiscrepancy: false, note: "Opening stock for the imported sales history", receivedAt: stockDay, receivedById: manufacturerUser, ...audit(manufacturerUser, stockDay) };
  const products: Product[] = [];
  const batches: Batch[] = [];
  const shipments: Transfer[] = [raw];
  const batchFor = new Map<string, Batch>();
  skuNames.forEach((sku, index) => {
    const product = existingProducts.find((item) => item.name === sku) ?? { id: createUuidV7(), hubId, organizationId: seedIds.manufacturer, name: sku, unit: "UNIT" as const, ...audit(manufacturerUser, stockDay) };
    if (!existingProducts.includes(product)) products.push(product);
    // Everything ever ordered, plus 10 cartons of 12 left over for live demos.
    const units = orders.reduce((sum, order) => sum + order.lines.filter((line) => line.sku === sku).reduce((total, line) => total + line.quantity, 0), 0) + 120;
    const batch: Batch = { id: createUuidV7(), hubId, organizationId: seedIds.manufacturer, number: batchNumber + index + 1, productId: product.id, transferIds: [raw.id], inputKg: "0", quantityProduced: String(units), wastageKg: "0", producedAt: stockDay, ...audit(manufacturerUser, stockDay) };
    batches.push(batch);
    batchFor.set(sku, batch);
    shipments.push({ id: createUuidV7(), hubId, kind: "FINISHED_GOODS", fromOrganizationId: seedIds.manufacturer, toOrganizationId: seedIds.distributor, deliveryIds: [], productId: product.id, batchId: batch.id, unit: "UNIT", quantitySent: String(units), quantityReceived: String(units), status: "RECEIVED", hasDiscrepancy: false, note: "Opening stock for the imported sales history", receivedAt: stockDay, receivedById: distributorUser, ...audit(manufacturerUser, stockDay) });
  });
  const productFor = (sku: string) => batchFor.get(sku)!.productId;

  // ---- Orders and their sales ----
  const existingOrders = await repository.list("Order", hubId);
  let orderNumber = existingOrders.reduce((max, order) => Math.max(max, order.number), 0);
  const orderRecords: Order[] = [];
  const sales: Sale[] = [];
  const salesByOrder = new Map<string, Sale[]>();
  const orderByReference = new Map<string, Order>();
  for (const draft of orders) {
    const at = noon(draft.date);
    const customer = customers.get(customerKey(draft.name) || "walkin")!;
    const cancelled = draft.status === "cancelled";
    const pending = draft.status === "pending";
    const delivery = deliveredBy.get(draft.number);
    const deliveredOn = [delivery?.on, draft.deliveredOn].find((date): date is string => Boolean(date && date >= draft.date && date <= now.toISOString().slice(0, 10))) ?? draft.date;
    const order: Order = { id: createUuidV7(), hubId, distributorId: seedIds.distributor, number: (orderNumber += 1), reference: draft.number, customerId: customer.id, orderedOn: draft.date, category: draft.category, channel: draft.channel, status: cancelled ? "CANCELLED" : pending ? "PENDING" : "DELIVERED", discountBasisPoints: Math.min(10_000, Math.max(0, draft.discount)), deliveredBy: cancelled || pending ? undefined : delivery?.by, deliveredOn: cancelled || pending ? undefined : deliveredOn, cancelledAt: cancelled ? at : undefined, cancelledById: cancelled ? distributorUser : undefined, cancelReason: cancelled ? cancelReason.get(draft.number) ?? "Cancelled" : undefined, currency: "USD", ...audit(distributorUser, at) };
    const orderSales = draft.lines.map((line): Sale => {
      const discountMinor = Math.max(0, Math.min(line.valueMinor, line.valueMinor - line.paymentMinor));
      return { id: createUuidV7(), hubId, distributorId: seedIds.distributor, customerId: customer.id, productId: productFor(line.sku), batchId: batchFor.get(line.sku)!.id, quantity: String(line.quantity), unitPriceMinor: line.priceMinor, amountMinor: line.valueMinor, discountMinor: discountMinor || undefined, currency: "USD", soldAt: at, orderId: order.id, ...(cancelled ? { voidedAt: at, voidedById: distributorUser, voidReason: `Order cancelled: ${order.cancelReason}` } : {}), ...audit(distributorUser, at) };
    });
    orderRecords.push(order);
    orderByReference.set(draft.number, order);
    salesByOrder.set(order.id, orderSales);
    sales.push(...orderSales);
  }

  // ---- Payments: an invoice per paid or billable order, and a collection per payment ----
  type Payment = { date: string; minor: number; method: PaymentMethod; note: string };
  const paymentsByOrder = new Map<string, Payment[]>();
  if (payments) {
    const P = { date: payments.col("Date"), number: payments.col("Order No"), usd: payments.col("USD Payment"), lrd: payments.col("LRD Payment"), rate: payments.col("Exchange Rate"), total: payments.col("Total USD Payment"), mode: payments.col("Payment Mode") };
    for (const row of payments.rows) {
      const number = clean(row[P.number]);
      const minor = parseCents(row[P.total]);
      const date = parseDate(row[P.date]);
      if (!number || minor <= 0 || !date) continue;
      const lrd = parseCents(row[P.lrd]);
      const mode = clean(row[P.mode]);
      // Keep what Kinja's methods cannot say: LRD paid and the rate used, or the app (TipMe, PayPal...).
      const plain = ["cash", "mtn mobilemoney"].includes(norm(mode));
      const note = [lrd > 0 ? `Paid LRD ${(lrd / 100).toFixed(2)} at ${clean(row[P.rate])}` : "", plain ? "" : mode].filter(Boolean).join(" · ");
      paymentsByOrder.set(number, [...(paymentsByOrder.get(number) ?? []), { date, minor, method: methods[norm(mode)] ?? "CASH", note: note || `Imported ${number}` }]);
    }
  }
  const existingInvoices = await repository.list("Invoice", hubId);
  let invoiceNumber = existingInvoices.reduce((max, invoice) => Math.max(max, invoice.number), 0);
  const invoices: Invoice[] = [];
  const collections: Collection[] = [];
  for (const order of orderRecords) {
    if (order.status !== "DELIVERED") continue;
    const orderSales = salesByOrder.get(order.id)!;
    const totalMinor = orderSales.reduce((sum, sale) => sum + sale.amountMinor - (sale.discountMinor ?? 0), 0);
    const paid = paymentsByOrder.get(order.reference!) ?? [];
    // Free samples with nothing paid are not invoiced.
    if (totalMinor === 0 || (order.category === "SAMPLE" && paid.length === 0)) continue;
    const issuedAt = noon(order.deliveredOn ?? order.orderedOn);
    const invoice: Invoice = { id: createUuidV7(), hubId, distributorId: seedIds.distributor, number: (invoiceNumber += 1), customerId: order.customerId, saleIds: orderSales.map((sale) => sale.id), totalMinor, currency: "USD", issuedAt, dueDate: issuedAt.slice(0, 10), ...audit(distributorUser, issuedAt) };
    invoices.push(invoice);
    for (const sale of orderSales) sale.invoiceId = invoice.id;
    let outstanding = totalMinor;
    for (const payment of paid.sort((a, b) => a.date.localeCompare(b.date))) {
      // Overpayments in the sheet (rounding, tips) are capped at what was owed.
      const amountMinor = Math.min(payment.minor, outstanding);
      if (amountMinor <= 0) break;
      outstanding -= amountMinor;
      const receivedAt = noon(payment.date < order.orderedOn ? order.orderedOn : payment.date);
      collections.push({ id: createUuidV7(), hubId, invoiceId: invoice.id, amountMinor, method: payment.method, reference: payment.note.slice(0, 120), receivedAt, ...audit(distributorUser, receivedAt) });
    }
  }

  // ---- Exchange rates from the sheet (the tech admin's rate table, from each start date) ----
  const rates: ExchangeRate[] = [];
  if (reference) {
    const [from, rate] = [reference.col("From"), reference.col("Exchange Rate")];
    const techAdmin = (await repository.list("Membership")).find((membership) => membership.role === "TECH_ADMIN")?.userId ?? distributorUser;
    const existing = await repository.list("ExchangeRate");
    for (const row of reference.rows) {
      const start = parseDate(row[from]);
      const value = Number(clean(row[rate]));
      if (!start || !(value > 0) || existing.some((item) => item.effectiveFrom === `${start}T00:00:00.000Z`)) continue;
      rates.push({ id: createUuidV7(), countryId: "lr", currency: "USD", rateTenThousandths: Math.round(value * 10_000), effectiveFrom: `${start}T00:00:00.000Z`, ...audit(techAdmin, `${start}T00:00:00.000Z`) });
    }
  }

  // One write per collection keeps this fast; every record is still validated.
  await repository.putMany("ExchangeRate", rates);
  await repository.putMany("Customer", [...customers.values()]);
  await repository.putMany("Product", products);
  await repository.putMany("Transfer", shipments);
  await repository.putMany("Batch", batches);
  await repository.putMany("Order", orderRecords);
  await repository.putMany("Sale", sales);
  await repository.putMany("Invoice", invoices);
  await repository.putMany("Collection", collections);

  return { orders: orderRecords.length, lines: sales.length, customers: customers.size, invoices: invoices.length, collections: collections.length, cancelled: orderRecords.filter((order) => order.status === "CANCELLED").length, skus: skuNames, rates: rates.length, firstDate, lastDate: orders[orders.length - 1].date, skipped };
}
