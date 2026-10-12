import { ClipboardList, Sprout, UsersRound } from "lucide-react";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { ChartCard, ColumnChart, compactNumber, GREEN, HBarChart, monthBuckets, RED, StackedBarChart } from "@/components/charts/charts";
import { ReportTable } from "@/components/market/order-dashboard";
import { formatKilograms, kilogramsToGrams } from "@/domain/money";
import { listDeliveries, listHubCropOptions } from "@/field/deliveries";
import { listFarmers } from "@/field/farmers";
import { AwaitingSyncCount } from "@/components/field/queued-records";
import { RoleDashboard } from "../role-dashboard";

export default async function CooperativeDashboard() {
  const account = await requireCooperativeMember();
  const { hubId, organizationId } = account.scope;
  const [farmers, allDeliveries, crops] = await Promise.all([listFarmers(hubId, organizationId), listDeliveries(hubId, organizationId), listHubCropOptions(hubId)]);
  const deliveries = allDeliveries.filter((delivery) => !delivery.voidedAt);
  const grams = (items: typeof deliveries) => items.reduce((sum, delivery) => sum + kilogramsToGrams(delivery.kilograms), 0);
  const kg = (value: number) => formatKilograms(value);
  // Rejected produce is the grade priced at zero.
  const rejected = (delivery: (typeof deliveries)[number]) => delivery.priceMinorPerKg === 0;
  const perMonth = monthBuckets(deliveries, (delivery) => delivery.createdAt).map((bucket) => ({ key: bucket.key, axisLabel: bucket.axisLabel, value: grams(bucket.items), count: bucket.items.length, tip: { title: bucket.title, rows: [["Delivered", kg(grams(bucket.items))], ["Deliveries", String(bucket.items.length)], ["Farmers", String(new Set(bucket.items.map((delivery) => delivery.farmerId)).size)]] as Array<[string, string]> } }));
  const byCrop = crops.map((crop) => { const items = deliveries.filter((delivery) => delivery.cropId === crop.cropId); return { name: crop.name, accepted: grams(items.filter((delivery) => !rejected(delivery))), rejected: grams(items.filter(rejected)) }; }).filter((crop) => crop.accepted + crop.rejected > 0).sort((a, b) => b.accepted + b.rejected - (a.accepted + a.rejected));
  const signups = monthBuckets(farmers, (farmer) => farmer.createdAt).map((bucket) => ({ key: bucket.key, axisLabel: bucket.axisLabel, value: bucket.items.length, tip: { title: bucket.title, rows: [["Farmers registered", String(bucket.items.length)], ["Women", String(bucket.items.filter((farmer) => farmer.gender === "FEMALE").length)]] as Array<[string, string]> } }));
  const genders = ([["FEMALE", "Women"], ["MALE", "Men"]] as const).map(([gender, label]) => ({ label, count: farmers.filter((farmer) => farmer.gender === gender).length }));
  const share = (part: number, whole: number) => whole ? `${Math.round((part / whole) * 1000) / 10}%` : "—";
  const thisMonth = new Date().toISOString().slice(0, 7);
  return <RoleDashboard account={account} eyebrow="Cooperative" title="Field work, kept together." description="Register farmers, track plots and record deliveries for the cooperative you work with." stats={[{ label: "Farmers", value: String(farmers.length), detail: "Registered in your cooperative" }, { label: "Deliveries", value: String(deliveries.filter((delivery) => !delivery.voidedAt && delivery.createdAt.startsWith(thisMonth)).length), detail: "This month" }, { label: "Awaiting sync", value: <AwaitingSyncCount userId={account.user.id} />, detail: "Saved on this device" }]} actions={[{ label: "Register farmers", description: "Add farmers, plots, and the crops they grow.", href: "/dashboard/cooperative/farmers", icon: <UsersRound size={20} aria-hidden="true" /> }, { label: "Record a delivery", description: "Capture weight, grade, and price snapshot.", href: "/dashboard/cooperative/deliveries/new", icon: <ClipboardList size={20} aria-hidden="true" /> }, { label: "Crops", description: "Review the crops connected to your work.", href: "/dashboard/cooperative/crops", icon: <Sprout size={20} aria-hidden="true" /> }]} >
    {/* Charts in one green on white; rejected produce in red. */}
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard className="xl:col-span-2" description="Kilograms delivered by your farmers each month." table={<ReportTable headers={["Month", "Delivered", "Deliveries"]} rows={perMonth.map((point) => [point.tip.title, kg(point.value), point.count])} />} title="Deliveries over time">
        <ColumnChart data={perMonth} empty="No deliveries recorded yet." formatTick={(value) => value === 0 ? "0" : `${compactNumber(value / 1000)} kg`} peakLabel={(value) => kg(value)} />
      </ChartCard>
      <ChartCard description="Kilograms delivered, by crop." legend={[{ label: "Accepted", color: GREEN }, { label: "Rejected", color: RED }]} table={<ReportTable headers={["Crop", "Accepted", "Rejected", "Total", "Rejected share"]} rows={byCrop.map((crop) => [crop.name, kg(crop.accepted), kg(crop.rejected), kg(crop.accepted + crop.rejected), share(crop.rejected, crop.accepted + crop.rejected)])} />} title="Deliveries by crop">
        <StackedBarChart data={byCrop.map((crop) => ({ label: crop.name, total: crop.accepted + crop.rejected, display: kg(crop.accepted + crop.rejected), parts: [{ value: crop.accepted, color: GREEN }, { value: crop.rejected, color: RED }], tip: { title: crop.name, rows: [["Accepted", kg(crop.accepted)], ["Rejected", kg(crop.rejected)], ["Rejected share", share(crop.rejected, crop.accepted + crop.rejected)]] } }))} />
      </ChartCard>
      <ChartCard description="Farmers registered in your cooperative." table={<ReportTable headers={["Group", "Farmers", "Share"]} rows={genders.map((group) => [group.label, group.count, share(group.count, farmers.length)])} />} title="Farmers by gender">
        <HBarChart data={genders.map((group) => ({ label: group.label, value: group.count, display: `${group.count} · ${share(group.count, farmers.length)}`, tip: { title: group.label, rows: [["Farmers", String(group.count)], ["Share", share(group.count, farmers.length)]] } }))} empty="No farmers registered yet." />
      </ChartCard>
      <ChartCard className="xl:col-span-2" description="New farmers registered each month." table={<ReportTable headers={["Month", "Farmers registered"]} rows={signups.map((point) => [point.tip.title, point.value])} />} title="Farmers registered">
        <ColumnChart whole data={signups} empty="No farmers registered yet." formatTick={(value) => String(value)} peakLabel={(value) => `${value} farmers`} />
      </ChartCard>
    </div>
  </RoleDashboard>;
}