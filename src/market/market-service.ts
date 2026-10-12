import { z } from "zod";
import { requireOrganizationScope, requireRole, type Scope } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import { countries } from "@/config/countries";
import { createUuidV7 } from "@/domain/id";
import { amountForWeight, toThousandths } from "@/domain/money";
import { PaymentMethod, Quantity, type Collection, type Customer, type Hub, type Invoice, type InvoiceStatus, type Order, type ProductUnit, type Sale } from "@/domain/model";
import { batchLabel } from "@/manufacture/manufacture-service";
import { getRepository } from "@/repositories/server";

const live = <T extends { voidedAt?: string }>(record: T) => !record.voidedAt;
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export function hubCurrency(hub: Pick<Hub, "countryId">): string {
  return countries.find((country) => country.id === hub.countryId)?.currency ?? "LRD";
}

// What the customer owes for a sale: its amount less any order discount.
export const saleNetMinor = (sale: Pick<Sale, "amountMinor" | "discountMinor">) => sale.amountMinor - (sale.discountMinor ?? 0);

export const invoiceLabel = (invoice: Pick<Invoice, "number">) => `INV-${String(invoice.number).padStart(4, "0")}`;
export const orderLabel = (order: Pick<Order, "number" | "reference">) => order.reference ?? `ORD-${String(order.number).padStart(4, "0")}`;

// ---- Customers (owned by the hub; managed by the hub admin and distributors) ----

const CUSTOMER_ROLES = ["HUB_ADMIN", "DISTRIBUTOR"] as const;

export const CustomerInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: optionalText(30),
  email: z.union([z.literal(""), z.string().trim().email()]).optional().transform((email) => email || undefined),
  address: optionalText(200),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
});

export async function listCustomers(account: Account, { includeArchived = false } = {}): Promise<Customer[]> {
  const scope = requireRole(account, [...CUSTOMER_ROLES]);
  return (await getRepository().list("Customer", scope.hubId)).filter((customer) => includeArchived || !customer.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomer(account: Account, customerId: string): Promise<Customer | null> {
  const scope = requireRole(account, [...CUSTOMER_ROLES]);
  return getRepository().get("Customer", customerId, scope.hubId);
}

export async function saveCustomer(account: Account, customerId: string | null, input: unknown, now = new Date()): Promise<Customer> {
  const scope = requireRole(account, [...CUSTOMER_ROLES]);
  const details = CustomerInput.parse(input);
  const timestamp = now.toISOString();
  const repository = getRepository();
  let customer: Customer;
  if (customerId) {
    const existing = await repository.get("Customer", customerId, scope.hubId);
    if (!existing) throw new Error("Customer not found");
    // Every editable field is replaced, so clearing one in the form clears it here.
    customer = { ...existing, name: details.name, phone: details.phone, email: details.email, address: details.address, paymentTermsDays: details.paymentTermsDays, updatedAt: timestamp };
  } else {
    customer = { id: createUuidV7(), hubId: scope.hubId, ...details, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  }
  await repository.put("Customer", customer);
  return customer;
}

// Customers are archived, not deleted, so past sales and invoices keep their links.
export async function setCustomerArchived(account: Account, customerId: string, archived: boolean, now = new Date()): Promise<Customer> {
  const scope = requireRole(account, [...CUSTOMER_ROLES]);
  const customer = await getRepository().get("Customer", customerId, scope.hubId);
  if (!customer) throw new Error("Customer not found");
  const updated: Customer = { ...customer, archivedAt: archived ? now.toISOString() : undefined, updatedAt: now.toISOString() };
  await getRepository().put("Customer", updated);
  return updated;
}

// ---- Stock and sales ------------------------------------------------------

export type StockRow = { batchId: string; batchLabel: string; productId: string; productName: string; unit: ProductUnit; receivedThousandths: number; soldThousandths: number; availableThousandths: number };

// What a distributor holds: finished goods received per batch, minus what was sold.
export async function distributorStock(hubId: string, distributorId: string): Promise<StockRow[]> {
  const repository = getRepository();
  const [transfers, sales, batches, products] = await Promise.all([repository.list("Transfer", hubId), repository.list("Sale", hubId), repository.list("Batch", hubId), repository.list("Product", hubId)]);
  const rows = new Map<string, StockRow>();
  for (const transfer of transfers.filter((item) => live(item) && item.kind === "FINISHED_GOODS" && item.toOrganizationId === distributorId && item.status === "RECEIVED" && item.batchId)) {
    const batch = batches.find((item) => item.id === transfer.batchId);
    const product = products.find((item) => item.id === transfer.productId);
    if (!batch || !product || batch.voidedAt) continue;
    const row = rows.get(batch.id) ?? { batchId: batch.id, batchLabel: batchLabel(batch), productId: product.id, productName: product.name, unit: product.unit, receivedThousandths: 0, soldThousandths: 0, availableThousandths: 0 };
    row.receivedThousandths += toThousandths(transfer.quantityReceived!);
    rows.set(batch.id, row);
  }
  for (const sale of sales.filter((item) => live(item) && item.distributorId === distributorId)) {
    const row = rows.get(sale.batchId);
    if (row) row.soldThousandths += toThousandths(sale.quantity);
  }
  return [...rows.values()].map((row) => ({ ...row, availableThousandths: row.receivedThousandths - row.soldThousandths })).sort((a, b) => a.batchLabel.localeCompare(b.batchLabel));
}

export const SaleInput = z.object({
  customerId: z.string().min(1),
  batchId: z.string().min(1),
  quantity: Quantity.refine((value) => toThousandths(value) > 0, "Must be more than 0"),
  unitPriceMinor: z.number().int().nonnegative(),
});

// A sale names the batch it came from, so it traces back through transfers to farmers.
export async function createSale(account: Account, input: unknown, now = new Date()): Promise<Sale> {
  const scope = requireOrganizationScope(account, ["DISTRIBUTOR"], "DISTRIBUTOR");
  const details = SaleInput.parse(input);
  const customer = await getRepository().get("Customer", details.customerId, scope.hubId);
  if (!customer || customer.archivedAt) throw new Error("Choose an active customer");
  const stock = (await distributorStock(scope.hubId, scope.organizationId)).find((row) => row.batchId === details.batchId);
  if (!stock) throw new Error("You have no stock from this batch");
  if (toThousandths(details.quantity) > stock.availableThousandths) throw new Error("You cannot sell more than you have in stock");
  const timestamp = now.toISOString();
  const sale: Sale = { id: createUuidV7(), hubId: scope.hubId, distributorId: scope.organizationId, customerId: customer.id, productId: stock.productId, batchId: stock.batchId, quantity: details.quantity, unitPriceMinor: details.unitPriceMinor, amountMinor: amountForWeight(details.quantity, details.unitPriceMinor), currency: hubCurrency(account.hub!), soldAt: timestamp, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("Sale", sale);
  return sale;
}

export type SaleRow = Sale & { customerName: string; productName: string; batchLabel: string; unit: ProductUnit; invoiceLabel?: string; distributorName: string; orderLabel?: string; invoiceable: boolean; invoicePaid: boolean };

function visibleTo(scope: Scope, record: { distributorId: string }) {
  return scope.role === "HUB_ADMIN" || record.distributorId === scope.organizationId;
}

export async function listSales(account: Account): Promise<SaleRow[]> {
  const scope = requireRole(account, ["HUB_ADMIN", "DISTRIBUTOR"]);
  const repository = getRepository();
  const [sales, customers, products, batches, invoices, organizations, orders, collections] = await Promise.all([repository.list("Sale", scope.hubId), repository.list("Customer", scope.hubId), repository.list("Product", scope.hubId), repository.list("Batch", scope.hubId), repository.list("Invoice", scope.hubId), repository.list("Organization", scope.hubId), repository.list("Order", scope.hubId), repository.list("Collection", scope.hubId)]);
  return sales.filter((sale) => visibleTo(scope, sale)).map((sale) => {
    const invoice = invoices.find((item) => item.id === sale.invoiceId && live(item));
    const batch = batches.find((item) => item.id === sale.batchId);
    const product = products.find((item) => item.id === sale.productId);
    const order = sale.orderId ? orders.find((item) => item.id === sale.orderId) : undefined;
    return { ...sale, customerName: customers.find((item) => item.id === sale.customerId)?.name ?? "Customer", productName: product?.name ?? "Product", unit: product?.unit ?? "KG", batchLabel: batch ? batchLabel(batch) : "—", invoiceLabel: invoice ? invoiceLabel(invoice) : undefined, distributorName: organizations.find((item) => item.id === sale.distributorId)?.name ?? "", orderLabel: order ? orderLabel(order) : undefined, invoiceable: !sale.voidedAt && !invoice && (!order || order.status === "DELIVERED"), invoicePaid: Boolean(invoice) && collections.some((collection) => live(collection) && collection.invoiceId === invoice!.id) };
  }).sort((a, b) => b.soldAt.localeCompare(a.soldAt));
}

// ---- Invoices and collections ----------------------------------------------

export function invoiceStatus(invoice: Invoice, collectedMinor: number, now = new Date()): InvoiceStatus {
  if (invoice.voidedAt) return "VOID";
  if (collectedMinor >= invoice.totalMinor) return "PAID";
  if (invoice.dueDate < now.toISOString().slice(0, 10)) return "OVERDUE";
  return collectedMinor > 0 ? "PARTIALLY_PAID" : "ISSUED";
}

export const InvoiceInput = z.object({ customerId: z.string().min(1), saleIds: z.array(z.string().min(1)).min(1, "Select at least one sale") });

// Invoices are numbered one after another within each hub, and due after the customer's payment terms.
export async function createInvoice(account: Account, input: unknown, now = new Date()): Promise<Invoice> {
  const scope = requireOrganizationScope(account, ["DISTRIBUTOR"], "DISTRIBUTOR");
  const details = InvoiceInput.parse(input);
  const repository = getRepository();
  const customer = await repository.get("Customer", details.customerId, scope.hubId);
  if (!customer) throw new Error("Customer not found");
  const saleIds = [...new Set(details.saleIds)];
  const sales = await Promise.all(saleIds.map((id) => repository.get("Sale", id, scope.hubId)));
  if (sales.some((sale) => !sale || sale.voidedAt || sale.distributorId !== scope.organizationId || sale.customerId !== customer.id || sale.invoiceId)) throw new Error("Only your own uninvoiced sales to this customer can be invoiced");
  if (new Set(sales.map((sale) => sale!.currency)).size > 1) throw new Error("An invoice can only include sales in one currency");
  const orders = await repository.list("Order", scope.hubId);
  if (sales.some((sale) => sale!.orderId && orders.find((order) => order.id === sale!.orderId)?.status !== "DELIVERED")) throw new Error("Only delivered orders can be invoiced");

  const number = (await repository.list("Invoice", scope.hubId)).reduce((max, invoice) => Math.max(max, invoice.number), 0) + 1;
  const timestamp = now.toISOString();
  const dueDate = new Date(now.getTime() + customer.paymentTermsDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const invoice: Invoice = { id: createUuidV7(), hubId: scope.hubId, distributorId: scope.organizationId, number, customerId: customer.id, saleIds, totalMinor: sales.reduce((sum, sale) => sum + saleNetMinor(sale!), 0), currency: sales[0]!.currency, issuedAt: timestamp, dueDate, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await repository.put("Invoice", invoice);
  for (const sale of sales) await repository.put("Sale", { ...sale!, invoiceId: invoice.id, updatedAt: timestamp });
  return invoice;
}

export type InvoiceRow = Invoice & { label: string; customerName: string; distributorName: string; collectedMinor: number; outstandingMinor: number; status: InvoiceStatus };

export async function listInvoices(account: Account, now = new Date()): Promise<InvoiceRow[]> {
  const scope = requireRole(account, ["HUB_ADMIN", "DISTRIBUTOR"]);
  const repository = getRepository();
  const [invoices, collections, customers, organizations] = await Promise.all([repository.list("Invoice", scope.hubId), repository.list("Collection", scope.hubId), repository.list("Customer", scope.hubId), repository.list("Organization", scope.hubId)]);
  return invoices.filter((invoice) => visibleTo(scope, invoice)).map((invoice) => {
    const collectedMinor = collections.filter((collection) => live(collection) && collection.invoiceId === invoice.id).reduce((sum, collection) => sum + collection.amountMinor, 0);
    return { ...invoice, label: invoiceLabel(invoice), customerName: customers.find((item) => item.id === invoice.customerId)?.name ?? "Customer", distributorName: organizations.find((item) => item.id === invoice.distributorId)?.name ?? "", collectedMinor, outstandingMinor: invoice.voidedAt ? 0 : Math.max(0, invoice.totalMinor - collectedMinor), status: invoiceStatus(invoice, collectedMinor, now) };
  }).sort((a, b) => b.number - a.number);
}

export async function getInvoiceDetail(account: Account, invoiceId: string, now = new Date()): Promise<{ invoice: InvoiceRow; sales: SaleRow[]; collections: Collection[]; customer?: Customer } | null> {
  const invoice = (await listInvoices(account, now)).find((item) => item.id === invoiceId);
  if (!invoice) return null;
  const repository = getRepository();
  const [sales, collections, customer] = await Promise.all([listSales(account), repository.list("Collection", invoice.hubId), repository.get("Customer", invoice.customerId, invoice.hubId)]);
  return { invoice, sales: sales.filter((sale) => invoice.saleIds.includes(sale.id)), collections: collections.filter((collection) => collection.invoiceId === invoice.id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)), customer: customer ?? undefined };
}

export const CollectionInput = z.object({ amountMinor: z.number().int().positive(), method: PaymentMethod, reference: optionalText(120) });

// Payments received against an invoice, never more than what is still owed.
export async function recordCollection(account: Account, invoiceId: string, input: unknown, now = new Date()): Promise<Collection> {
  const scope = requireOrganizationScope(account, ["DISTRIBUTOR"], "DISTRIBUTOR");
  const details = CollectionInput.parse(input);
  const invoice = (await listInvoices(account, now)).find((item) => item.id === invoiceId && item.distributorId === scope.organizationId);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "VOID") throw new Error("This invoice was voided");
  if (details.amountMinor > invoice.outstandingMinor) throw new Error("The amount is more than what is still owed on this invoice");
  const timestamp = now.toISOString();
  const collection: Collection = { id: createUuidV7(), hubId: scope.hubId, invoiceId: invoice.id, amountMinor: details.amountMinor, method: details.method, reference: details.reference, receivedAt: timestamp, createdById: scope.userId, createdAt: timestamp, updatedAt: timestamp };
  await getRepository().put("Collection", collection);
  return collection;
}

export type CollectionRow = Collection & { invoiceLabel: string; customerName: string; currency: string };

export async function listCollections(account: Account): Promise<CollectionRow[]> {
  const invoices = await listInvoices(account);
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const collections = await getRepository().list("Collection", invoices[0]?.hubId ?? account.membership!.hubId);
  return collections.filter((collection) => byId.has(collection.invoiceId)).map((collection) => ({ ...collection, invoiceLabel: byId.get(collection.invoiceId)!.label, customerName: byId.get(collection.invoiceId)!.customerName, currency: byId.get(collection.invoiceId)!.currency })).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}
