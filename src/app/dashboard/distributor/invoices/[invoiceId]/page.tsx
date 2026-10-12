import { FileText, ReceiptText } from "lucide-react";
import { notFound } from "next/navigation";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { Badge, DashboardShell, formatDate, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { CollectionForm } from "@/components/market/collection-form";
import { InvoiceStatusBadge, paymentMethods, SalesTable } from "@/components/market/market-tables";
import { getMoneyContext } from "@/admin/exchange-rates";
import { moneyColumns } from "@/components/kinja/money";
import { formatIn, moneyItem } from "@/domain/currency";
import { getInvoiceDetail } from "@/market/market-service";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const detail = await getInvoiceDetail(account, (await params).invoiceId);
  if (!detail) notFound();
  const { invoice, sales, collections, customer } = detail;
  const money = await getMoneyContext(account.hub!);
  const download = (type: "invoice" | "receipt", label: string, icon: React.ReactNode) => <a className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cbd2c9] bg-white px-4 font-semibold text-[var(--kinja-green)] transition hover:bg-[#f7f9f5]" download href={`/market/invoices/${invoice.id}/document?type=${type}`}>{icon}{label}</a>;
  const item = (minor: number, at = invoice.issuedAt) => moneyItem(minor, invoice.currency, at);
  return <DashboardShell actions={<><span className="self-center"><InvoiceStatusBadge status={invoice.status} /></span>{download("invoice", "Invoice PDF", <FileText size={16} aria-hidden="true" />)}{collections.some((collection) => !collection.voidedAt) && download("receipt", "Receipt PDF", <ReceiptText size={16} aria-hidden="true" />)}</>} back={{ href: "/dashboard/distributor/invoices", label: "Invoices" }} description={`${invoice.customerName} · issued ${formatDate(invoice.issuedAt)} · due ${formatDate(`${invoice.dueDate}T00:00:00.000Z`)}${customer?.phone ? ` · ${customer.phone}` : ""}`} eyebrow="Invoice" title={invoice.label}>
    {invoice.voidReason && <p className="mb-4 rounded-xl border border-[#f3c7c2] bg-[#fdf1ef] px-4 py-3 text-sm text-[#9b2c1f]">Voided: {invoice.voidReason}</p>}
    {/* One row per currency: the invoice's own currency first, then the others converted. */}
    <div className="space-y-4">{[invoice.currency, ...money.currencies.filter((code) => code !== invoice.currency)].map((currency) => <SummaryGrid columns={3} key={currency}>
      <SummaryCard detail={`${invoice.saleIds.length} ${invoice.saleIds.length === 1 ? "sale" : "sales"}`} label={`Total · ${currency}`} value={formatIn(money, [item(invoice.totalMinor)], currency)} />
      <SummaryCard detail={`${collections.filter((collection) => !collection.voidedAt).length} payments`} label={`Collected · ${currency}`} value={formatIn(money, [item(invoice.collectedMinor)], currency)} />
      <SummaryCard detail={invoice.status === "OVERDUE" ? "Past the due date" : "Still owed"} label={`Outstanding · ${currency}`} tone={invoice.status === "OVERDUE" ? "warning" : undefined} value={formatIn(money, [item(invoice.outstandingMinor)], currency)} />
    </SummaryGrid>)}</div>
    {invoice.outstandingMinor > 0 && invoice.status !== "VOID" && <div className="mt-6"><CollectionForm currency={invoice.currency} money={money} invoiceId={invoice.id} outstandingMinor={invoice.outstandingMinor} /></div>}
    <SectionHeader title="Sales on this invoice" />
    <SalesTable money={money} sales={sales} />
    <SectionHeader title="Collections" />
    {collections.length === 0 ? <p className="mt-3 text-sm text-[#5d685e]">No payments recorded yet.</p> :
      <DataTable muted={(collection) => Boolean(collection.voidedAt)} rowKey={(collection) => collection.id} rows={collections} columns={[
        { header: "Date", cell: (collection) => formatDate(collection.receivedAt) },
        { header: "Method", cell: (collection) => paymentMethods[collection.method] },
        { header: "Reference", cell: (collection) => collection.reference ?? "—" },
        ...moneyColumns(money, "Amount", (collection: (typeof collections)[number]) => item(collection.amountMinor, collection.receivedAt), { strong: true }),
        { header: "Status", cell: (collection) => collection.voidedAt ? <Badge tone="grey">Voided</Badge> : <Badge tone="green">Received</Badge> },
      ]} />}
  </DashboardShell>;
}
