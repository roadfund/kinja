import { notFound } from "next/navigation";
import { requireDashboardRole } from "@/auth/route-authorization";
import { Badge, DashboardShell, DataTable, formatDate, SectionHeader, type Column } from "@/components/kinja/ui";
import { ReasonAction } from "@/components/ops/reason-action";
import { getMoneyContext } from "@/admin/exchange-rates";
import { moneyColumns } from "@/components/kinja/money";
import { moneyItem } from "@/domain/currency";
import { formatQuantity, toThousandths } from "@/domain/money";
import { roleLabels } from "@/domain/person";
import { listBatches, listTransfers } from "@/manufacture/manufacture-service";
import { listCollections, listInvoices, listSales } from "@/market/market-service";
import type { VoidableEntity } from "@/ops/moderation";
import { viewAccountForHub } from "@/ops/reporting-scope";
import { getRepository } from "@/repositories/server";

// Three columns per voidable table: when it was voided, why, and the Void action.
function voidColumns<T extends { id: string; voidedAt?: string; voidReason?: string }>(entity: VoidableEntity, label: (row: T) => string): Array<Column<T>> {
  return [
    { header: "Voided on", cell: (row) => row.voidedAt ? formatDate(row.voidedAt) : "—" },
    { header: "Void reason", cell: (row) => row.voidReason ?? "—" },
    { header: "", align: "right", cell: (row) => row.voidedAt ? null : <ReasonAction confirmLabel="Void record" description={`${label(row)} stays in Kinja, marked as voided, and no longer counts in totals.`} endpoint={`/ops/void/${entity}/${row.id}`} title={`Void ${label(row)}?`} triggerLabel="Void" /> },
  ];
}

const RECENT = 25;

export default async function HubModerationPage({ params }: { params: Promise<{ hubId: string }> }) {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const { hubId } = await params;
  const repository = getRepository();
  const hub = await repository.get("Hub", hubId);
  if (!hub) notFound();
  const viewer = await viewAccountForHub(account, hubId);
  const money = await getMoneyContext(hub);
  const [organizations, memberships, users, deliveries, farmers, crops, { transfers }, batches, sales, invoices, collections] = await Promise.all([repository.list("Organization", hubId), repository.list("Membership", hubId), repository.list("User"), repository.list("Delivery", hubId), repository.list("Farmer", hubId), repository.list("Crop"), listTransfers(viewer), listBatches(viewer), listSales(viewer), listInvoices(viewer), listCollections(viewer)]);
  const userName = (id: string) => users.find((user) => user.id === id)?.fullName ?? "Unknown";
  const orgName = (id?: string) => organizations.find((organization) => organization.id === id)?.name ?? hub.businessName;
  const members = memberships.filter((membership) => membership.status !== "REMOVED");
  const recentDeliveries = deliveries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT);

  return <DashboardShell back={{ href: "/admin/moderation", label: "Hubs and moderation" }} description={`${hub.regionOrCounty} · ${hub.status.replace("_", " ").toLowerCase()}`} eyebrow="Moderation" title={hub.businessName}>
    <SectionHeader description="Suspending an organization blocks all of its members" title="Organizations" />
    <DataTable rowKey={(organization) => organization.id} rows={organizations} columns={[
      { header: "Name", cell: (organization) => <span className="font-medium text-[#344e41]">{organization.name}</span> },
      { header: "Type", cell: (organization) => organization.type.charAt(0) + organization.type.slice(1).toLowerCase() },
      { header: "Members", align: "right", cell: (organization) => members.filter((membership) => membership.organizationId === organization.id).length },
      { header: "Status", cell: (organization) => organization.suspendedAt ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge> },
      { header: "Action", cell: (organization) => <ReasonAction body={{ suspend: !organization.suspendedAt }} confirmLabel={organization.suspendedAt ? "Reinstate" : "Suspend organization"} description={organization.suspendedAt ? "Members regain access straight away." : "All members are signed out and blocked until reinstated."} destructive={!organization.suspendedAt} endpoint={`/ops/moderation/organizations/${organization.id}`} title={`${organization.suspendedAt ? "Reinstate" : "Suspend"} ${organization.name}?`} triggerLabel={organization.suspendedAt ? "Reinstate" : "Suspend"} /> },
    ]} />

    <SectionHeader description="Suspending a user signs them out on every device" title="Users" />
    <DataTable rowKey={(membership) => membership.id} rows={members} columns={[
      { header: "Name", cell: (membership) => <span className="font-medium text-[#344e41]">{userName(membership.userId)}</span> },
      { header: "Role", cell: (membership) => roleLabels[membership.role] },
      { header: "Organization", cell: (membership) => orgName(membership.organizationId) },
      { header: "Status", cell: (membership) => membership.status === "SUSPENDED" ? <Badge tone="red">Suspended</Badge> : <Badge tone="green">Active</Badge> },
      { header: "Action", cell: (membership) => <ReasonAction body={{ suspend: membership.status === "ACTIVE" }} confirmLabel={membership.status === "ACTIVE" ? "Suspend user" : "Reinstate"} description={membership.status === "ACTIVE" ? "They are signed out and cannot sign in until reinstated." : "They can sign in again straight away."} destructive={membership.status === "ACTIVE"} endpoint={`/ops/moderation/members/${membership.id}`} title={`${membership.status === "ACTIVE" ? "Suspend" : "Reinstate"} ${userName(membership.userId)}?`} triggerLabel={membership.status === "ACTIVE" ? "Suspend" : "Reinstate"} /> },
    ]} />

    <SectionHeader description={`Latest ${RECENT}`} title="Deliveries" />
    <DataTable muted={(delivery) => Boolean(delivery.voidedAt)} rowKey={(delivery) => delivery.id} rows={recentDeliveries} columns={[
      { header: "Date", cell: (delivery) => formatDate(delivery.createdAt) },
      { header: "Farmer", cell: (delivery) => farmers.find((farmer) => farmer.id === delivery.farmerId)?.fullName ?? "Farmer" },
      { header: "Crop", cell: (delivery) => crops.find((crop) => crop.id === delivery.cropId)?.name ?? delivery.cropId },
      { header: "Weight", align: "right", cell: (delivery) => formatQuantity(toThousandths(delivery.kilograms), "KG") },
      ...voidColumns<(typeof recentDeliveries)[number]>("Delivery", () => "this delivery"),
    ]} />

    <SectionHeader title="Transfers" />
    <DataTable muted={(transfer) => Boolean(transfer.voidedAt)} rowKey={(transfer) => transfer.id} rows={transfers.slice(0, RECENT)} columns={[
      { header: "Sent", cell: (transfer) => formatDate(transfer.createdAt) },
      { header: "From", cell: (transfer) => transfer.fromName },
      { header: "To", cell: (transfer) => transfer.toName },
      { header: "Goods", cell: (transfer) => transfer.itemName },
      { header: "Sent", align: "right", cell: (transfer) => transfer.quantitySent },
      { header: "Received", align: "right", cell: (transfer) => transfer.quantityReceived ?? "—" },
      ...voidColumns<(typeof transfers)[number]>("Transfer", () => "this transfer"),
    ]} />

    <SectionHeader title="Batches" />
    <DataTable muted={(batch) => Boolean(batch.voidedAt)} rowKey={(batch) => batch.id} rows={batches.slice(0, RECENT)} columns={[
      { header: "Batch", cell: (batch) => batch.label },
      { header: "Manufacturer", cell: (batch) => batch.organizationName },
      { header: "Product", cell: (batch) => batch.productName },
      { header: "Output", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.quantityProduced), batch.unit) },
      ...voidColumns<(typeof batches)[number]>("Batch", (batch) => batch.label),
    ]} />

    <SectionHeader title="Sales" />
    <DataTable muted={(sale) => Boolean(sale.voidedAt)} rowKey={(sale) => sale.id} rows={sales.slice(0, RECENT)} columns={[
      { header: "Date", cell: (sale) => formatDate(sale.soldAt) },
      { header: "Customer", cell: (sale) => sale.customerName },
      { header: "Product", cell: (sale) => sale.productName },
      { header: "Batch", cell: (sale) => sale.batchLabel },
      ...moneyColumns(money, "Amount", (sale: (typeof sales)[number]) => moneyItem(sale.amountMinor - (sale.discountMinor ?? 0), sale.currency, sale.soldAt)),
      ...voidColumns<(typeof sales)[number]>("Sale", () => "this sale"),
    ]} />

    <SectionHeader title="Invoices" />
    <DataTable muted={(invoice) => Boolean(invoice.voidedAt)} rowKey={(invoice) => invoice.id} rows={invoices.slice(0, RECENT)} columns={[
      { header: "Invoice", cell: (invoice) => invoice.label },
      { header: "Customer", cell: (invoice) => invoice.customerName },
      ...moneyColumns(money, "Total", (invoice: (typeof invoices)[number]) => moneyItem(invoice.totalMinor, invoice.currency, invoice.issuedAt)),
      { header: "Status", cell: (invoice) => invoice.status.replace("_", " ").toLowerCase() },
      ...voidColumns<(typeof invoices)[number]>("Invoice", (invoice) => invoice.label),
    ]} />

    <SectionHeader title="Collections" />
    <DataTable muted={(collection) => Boolean(collection.voidedAt)} rowKey={(collection) => collection.id} rows={collections.slice(0, RECENT)} columns={[
      { header: "Date", cell: (collection) => formatDate(collection.receivedAt) },
      { header: "Invoice", cell: (collection) => collection.invoiceLabel },
      ...moneyColumns(money, "Amount", (collection: (typeof collections)[number]) => moneyItem(collection.amountMinor, collection.currency, collection.receivedAt)),
      ...voidColumns<(typeof collections)[number]>("Collection", () => "this collection"),
    ]} />
  </DashboardShell>;
}
