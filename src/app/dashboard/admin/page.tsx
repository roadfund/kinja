import { BarChart3, Building2, FileCheck2, ShieldAlert } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { ChartCard, ColumnChart, GREEN, GREEN_LIGHT, HBarChart, monthBuckets, RED } from "@/components/charts/charts";
import { ReportTable } from "@/components/market/order-dashboard";
import Link from "next/link";
import { Badge, EmptyState, formatDate, SectionHeader, type BadgeTone } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { countries } from "@/config/countries";
import { getRepository } from "@/repositories/server";
import { RoleDashboard } from "../role-dashboard";

export default async function AdminDashboard() {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const repository = getRepository();
  const [hubs, transfers, orders, deliveries, memberships] = await Promise.all([repository.list("Hub"), repository.list("Transfer"), repository.list("Order"), repository.list("Delivery"), repository.list("Membership")]);
  const statusBadge: Record<string, [string, BadgeTone]> = { VERIFIED: ["Verified", "green"], PENDING_VERIFICATION: ["Pending review", "amber"], REJECTED: ["Rejected", "red"], SUSPENDED: ["Suspended", "red"] };
  const allHubs = [...hubs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statuses = [{ status: "VERIFIED", label: "Verified", color: GREEN }, { status: "PENDING_VERIFICATION", label: "Pending review", color: GREEN_LIGHT }, { status: "REJECTED", label: "Rejected", color: RED }, { status: "SUSPENDED", label: "Suspended", color: RED }].map((row) => ({ ...row, count: hubs.filter((hub) => hub.status === row.status).length }));
  const hubName = (hubId: string) => hubs.find((hub) => hub.id === hubId)?.businessName ?? "Hub";
  // Activity across every hub, by month.
  const activity = (records: Array<{ hubId: string; createdAt: string }>, noun: string) => monthBuckets(records, (record) => record.createdAt, 36).map((bucket) => ({ key: bucket.key, axisLabel: bucket.axisLabel, value: bucket.items.length, tip: { title: bucket.title, rows: [[noun, String(bucket.items.length)], ["Hubs active", String(new Set(bucket.items.map((record) => record.hubId)).size)]] as Array<[string, string]> } }));
  const orderMonths = activity(orders.map((order) => ({ hubId: order.hubId, createdAt: order.orderedOn })), "Orders");
  const deliveryMonths = activity(deliveries.filter((delivery) => !delivery.voidedAt), "Deliveries");
  const ordersByHub = [...new Set(orders.map((order) => order.hubId))].map((hubId) => ({ hubId, count: orders.filter((order) => order.hubId === hubId).length }));
  const flags = transfers.filter((transfer) => transfer.hasDiscrepancy && !transfer.voidedAt).length;
  return <RoleDashboard account={account} eyebrow="Tech admin" title="Keep the platform trusted." description="Review hubs, moderate organizations and users, and keep every value chain accountable." stats={[{ label: "Pending hubs", value: String(hubs.filter((hub) => hub.status === "PENDING_VERIFICATION").length), detail: "Awaiting review" }, { label: "Verified hubs", value: String(hubs.filter((hub) => hub.status === "VERIFIED").length), detail: `${hubs.filter((hub) => hub.status === "SUSPENDED").length} suspended` }, { label: "Open flags", value: String(flags), detail: "Transfer discrepancies" }]} actions={[{ label: "Review hubs", description: "Verify or reject submitted business details.", href: "/admin/hubs", icon: <FileCheck2 size={20} aria-hidden="true" /> }, { label: "Moderation", description: "Suspend hubs, organizations and users, or void records.", href: "/admin/moderation", icon: <ShieldAlert size={20} aria-hidden="true" /> }, { label: "Reports", description: "Impact, monthly reports and exports for any hub.", href: "/admin/ops", icon: <BarChart3 size={20} aria-hidden="true" /> }]} >
    {/* Platform activity, green on white; rejected and suspended hubs in red. */}
    {/* Every hub on the platform, newest first; open one to moderate it. */}
    <SectionHeader description={`${hubs.length} ${hubs.length === 1 ? "hub" : "hubs"} on Kinja`} title="Hubs" />
    {allHubs.length === 0 ? <EmptyState description="Hubs appear here when a company signs up and onboards." icon={<Building2 size={22} aria-hidden="true" />} title="No hubs yet" /> :
      <DataTable rowKey={(hub) => hub.id} rows={allHubs} columns={[
        { header: "Hub", cell: (hub) => <Link className="font-semibold text-[var(--kinja-green)] hover:underline" href={`/admin/moderation/${hub.id}`}>{hub.businessName}</Link> },
        { header: "Status", cell: (hub) => <Badge tone={statusBadge[hub.status][1]}>{statusBadge[hub.status][0]}</Badge> },
        { header: "Country", cell: (hub) => countries.find((country) => country.id === hub.countryId)?.name ?? hub.countryId.toUpperCase() },
        { header: "Region", cell: (hub) => hub.regionOrCounty },
        { header: "Category", cell: (hub) => hub.businessCategory },
        { header: "Contact", cell: (hub) => hub.contactPerson.fullName },
        { header: "Contact phone", cell: (hub) => hub.contactPerson.phone },
        { header: "Members", align: "right", cell: (hub) => memberships.filter((membership) => membership.hubId === hub.id && membership.status === "ACTIVE").length },
        { header: "Orders", align: "right", cell: (hub) => orders.filter((order) => order.hubId === hub.id).length },
        { header: "Joined", cell: (hub) => formatDate(hub.createdAt) },
        { header: "", align: "right", cell: (hub) => hub.status === "PENDING_VERIFICATION" ? <Link className="text-sm font-semibold text-[var(--kinja-green)] underline" href="/admin/hubs">Review</Link> : <Link className="text-sm font-semibold text-[var(--kinja-green)] underline" href={`/admin/moderation/${hub.id}`}>Manage</Link> },
      ]} />}

    <div className="mt-10 grid gap-4 xl:grid-cols-2">
      <ChartCard description="Every hub on Kinja, by where it stands." table={<ReportTable headers={["Status", "Hubs"]} rows={statuses.map((row) => [row.label, row.count])} />} title="Hubs by status">
        <HBarChart data={statuses.map((row) => ({ label: row.label, value: row.count, color: row.color, display: String(row.count), tip: { title: row.label, rows: [["Hubs", String(row.count)]] } }))} empty="No hubs yet." />
      </ChartCard>
      <ChartCard description="Customer orders recorded, by hub." table={<ReportTable headers={["Hub", "Orders"]} rows={ordersByHub.map((row) => [hubName(row.hubId), row.count])} />} title="Orders by hub">
        <HBarChart data={ordersByHub.sort((a, b) => b.count - a.count).map((row) => ({ label: hubName(row.hubId), value: row.count, display: String(row.count), tip: { title: hubName(row.hubId), rows: [["Orders", String(row.count)]] } }))} empty="No orders yet." />
      </ChartCard>
      <ChartCard className="xl:col-span-2" description="Customer orders across all hubs, by order month." table={<ReportTable headers={["Month", "Orders"]} rows={orderMonths.map((point) => [point.tip.title, point.value])} />} title="Orders over time">
        <ColumnChart whole data={orderMonths} empty="No orders yet." formatTick={(value) => String(value)} peakLabel={(value) => `${value} orders`} />
      </ChartCard>
      <ChartCard className="xl:col-span-2" description="Farmer deliveries across all hubs, by month." table={<ReportTable headers={["Month", "Deliveries"]} rows={deliveryMonths.map((point) => [point.tip.title, point.value])} />} title="Deliveries over time">
        <ColumnChart whole data={deliveryMonths} empty="No deliveries yet." formatTick={(value) => String(value)} peakLabel={(value) => `${value} deliveries`} />
      </ChartCard>
    </div>
  </RoleDashboard>;
}
