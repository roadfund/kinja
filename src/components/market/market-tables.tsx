import Link from "next/link";
import { Badge, DataTable, formatDate, type BadgeTone } from "@/components/kinja/ui";
import type { InvoiceStatus } from "@/domain/model";
import { moneyColumns } from "@/components/kinja/money";
import { DocumentMenu } from "@/components/market/document-menu";
import { moneyItem, type MoneyContext } from "@/domain/currency";
import { formatQuantity, toThousandths } from "@/domain/money";
import { saleNetMinor, type CollectionRow, type InvoiceRow, type SaleRow } from "@/market/market-service";

const invoiceStatus: Record<InvoiceStatus, [string, BadgeTone]> = { ISSUED: ["Issued", "neutral"], PARTIALLY_PAID: ["Partly paid", "amber"], PAID: ["Paid", "green"], OVERDUE: ["Overdue", "red"], VOID: ["Void", "grey"] };
export const paymentMethods = { MOBILE_MONEY: "Mobile money", CASH: "Cash", BANK_TRANSFER: "Bank transfer" } as const;

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceStatus[status][1]}>{invoiceStatus[status][0]}</Badge>;
}

export function SalesTable({ sales, money, showDistributor = false }: { sales: SaleRow[]; money: MoneyContext; showDistributor?: boolean }) {
  return <DataTable muted={(sale) => Boolean(sale.voidedAt)} rowKey={(sale) => sale.id} rows={sales} columns={[
    { header: "Date", cell: (sale) => formatDate(sale.soldAt) },
    { header: "Order", cell: (sale) => sale.orderLabel ?? "—" },
    ...(showDistributor ? [{ header: "Distributor", cell: (sale: SaleRow) => sale.distributorName }] : []),
    { header: "Customer", cell: (sale) => <span className="font-medium text-[#344e41]">{sale.customerName}</span> },
    { header: "Product", cell: (sale) => sale.productName },
    { header: "Batch", cell: (sale) => sale.batchLabel },
    { header: "Quantity", align: "right", cell: (sale) => formatQuantity(toThousandths(sale.quantity), sale.unit) },
    ...moneyColumns(money, "Unit price", (sale: SaleRow) => moneyItem(sale.unitPriceMinor, sale.currency, sale.soldAt)),
    { header: "Discount", align: "right", cell: (sale) => sale.discountMinor ? `${Math.round((sale.discountMinor / sale.amountMinor) * 1000) / 10}%` : "—" },
    ...moneyColumns(money, "Amount", (sale: SaleRow) => moneyItem(saleNetMinor(sale), sale.currency, sale.soldAt), { strong: true }),
    { header: "Invoice", cell: (sale) => sale.voidedAt ? <Badge tone="grey">Voided</Badge> : sale.invoiceLabel ?? (sale.invoiceable ? <Badge tone="amber">Not invoiced</Badge> : <Badge tone="grey">Order pending</Badge>) },
    { header: "", align: "right", className: "w-12", cell: (sale) => <DocumentMenu invoiceId={sale.invoiceLabel ? sale.invoiceId : undefined} invoiceLabel={sale.invoiceLabel} paid={sale.invoicePaid} voided={Boolean(sale.voidedAt)} /> },
  ]} />;
}

export function InvoiceTable({ invoices, money, linkBase, showDistributor = false }: { invoices: InvoiceRow[]; money: MoneyContext; linkBase?: string; showDistributor?: boolean }) {
  return <DataTable muted={(invoice) => invoice.status === "VOID"} rowKey={(invoice) => invoice.id} rows={invoices} columns={[
    { header: "Invoice", cell: (invoice) => linkBase ? <Link className="font-semibold text-[var(--kinja-green)] hover:underline" href={`${linkBase}/${invoice.id}`}>{invoice.label}</Link> : <span className="font-semibold text-[var(--kinja-green)]">{invoice.label}</span> },
    ...(showDistributor ? [{ header: "Distributor", cell: (invoice: InvoiceRow) => invoice.distributorName }] : []),
    { header: "Customer", cell: (invoice) => <span className="text-[#344e41]">{invoice.customerName}</span> },
    { header: "Issued", cell: (invoice) => formatDate(invoice.issuedAt) },
    { header: "Due", cell: (invoice) => formatDate(`${invoice.dueDate}T00:00:00.000Z`) },
    ...moneyColumns(money, "Total", (invoice: InvoiceRow) => moneyItem(invoice.totalMinor, invoice.currency, invoice.issuedAt)),
    ...moneyColumns(money, "Collected", (invoice: InvoiceRow) => moneyItem(invoice.collectedMinor, invoice.currency, invoice.issuedAt)),
    ...moneyColumns(money, "Outstanding", (invoice: InvoiceRow) => moneyItem(invoice.outstandingMinor, invoice.currency, invoice.issuedAt), { strong: true }),
    { header: "Status", cell: (invoice) => <InvoiceStatusBadge status={invoice.status} /> },
    { header: "", align: "right", className: "w-12", cell: (invoice) => <DocumentMenu invoiceId={invoice.id} invoiceLabel={invoice.label} paid={invoice.collectedMinor > 0} /> },
  ]} />;
}

export function CollectionsTable({ collections, money }: { collections: CollectionRow[]; money: MoneyContext }) {
  return <DataTable muted={(collection) => Boolean(collection.voidedAt)} rowKey={(collection) => collection.id} rows={collections} columns={[
    { header: "Date", cell: (collection) => formatDate(collection.receivedAt) },
    { header: "Invoice", cell: (collection) => <span className="font-medium text-[#344e41]">{collection.invoiceLabel}</span> },
    { header: "Customer", cell: (collection) => collection.customerName },
    { header: "Method", cell: (collection) => paymentMethods[collection.method] },
    { header: "Reference", cell: (collection) => collection.reference ?? "—" },
    ...moneyColumns(money, "Amount", (collection: CollectionRow) => moneyItem(collection.amountMinor, collection.currency, collection.receivedAt), { strong: true }),
    { header: "Status", cell: (collection) => collection.voidedAt ? <Badge tone="grey">Voided</Badge> : <Badge tone="green">Received</Badge> },
  ]} />;
}
