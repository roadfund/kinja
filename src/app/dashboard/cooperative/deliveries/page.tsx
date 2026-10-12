import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { Avatar } from "@/components/avatar";
import { getMoneyContext } from "@/admin/exchange-rates";
import { moneyColumns } from "@/components/kinja/money";
import { Badge, formatDate } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { moneyItem, moneyLines } from "@/domain/currency";
import { formatKilograms, kilogramsToGrams } from "@/domain/money";
import { listDeliveries, listHubCropOptions } from "@/field/deliveries";
import { listFarmers } from "@/field/farmers";
import { ExportLinks } from "@/components/ops/export-links";
import { QueuedRecords } from "@/components/field/queued-records";
import { CooperativeShell } from "../cooperative-shell";

function SummaryCard({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">{label}</p><p className="mt-2 truncate text-3xl font-semibold text-[var(--kinja-green)]">{value}</p><p className="mt-1 text-sm text-[#5d685e]">{detail}</p></div>;
}

export default async function DeliveriesPage() {
  const { scope, user, hub } = await requireCooperativeMember();
  const { hubId, organizationId } = scope;
  const [allDeliveries, farmers, crops] = await Promise.all([listDeliveries(hubId, organizationId), listFarmers(hubId, organizationId), listHubCropOptions(hubId)]);
  const money = await getMoneyContext(hub!);

  // Voided deliveries stay listed but no longer count in any total.
  const deliveries = allDeliveries.filter((delivery) => !delivery.voidedAt);
  const farmersById = new Map(farmers.map((farmer) => [farmer.id, farmer]));
  const cropsById = new Map(crops.map((crop) => [crop.cropId, crop]));
  const currency = crops[0]?.currency ?? "LRD";
  const gradeName = (cropId: string, gradeId: string) => cropsById.get(cropId)?.grades.find((grade) => grade.gradeId === gradeId)?.name ?? gradeId;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const totalGrams = deliveries.reduce((sum, delivery) => sum + kilogramsToGrams(delivery.kilograms), 0);
  const totalOwed = deliveries.map((delivery) => moneyItem(delivery.amountOwedMinor, currency, delivery.createdAt));
  const gramsByCrop = new Map<string, number>();
  for (const delivery of deliveries) gramsByCrop.set(delivery.cropId, (gramsByCrop.get(delivery.cropId) ?? 0) + kilogramsToGrams(delivery.kilograms));
  const [topCrop] = [...gramsByCrop].sort((a, b) => b[1] - a[1]);
  const farmersDelivering = new Set(deliveries.map((delivery) => delivery.farmerId)).size;
  const rejected = deliveries.filter((delivery) => delivery.priceMinorPerKg === 0).length;

  return <CooperativeShell actions={<ExportLinks datasets={["deliveries"]} />} eyebrow="Kinja Field" title="Deliveries" description="Produce delivered by your farmers, with the weight, grade and amount owed for each delivery.">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard label="Deliveries" value={String(deliveries.length)} detail={`${deliveries.filter((delivery) => delivery.createdAt.startsWith(thisMonth)).length} recorded this month`} />
      <SummaryCard label="Total weight" value={formatKilograms(totalGrams)} detail="Across all deliveries" />
      {moneyLines(money, totalOwed).map((line) => <SummaryCard detail="Before payouts" key={line.currency} label={`Amount owed · ${line.currency}`} value={line.text} />)}
      <SummaryCard label="Most delivered crop" value={topCrop ? cropsById.get(topCrop[0])?.name ?? topCrop[0] : "—"} detail={topCrop ? `${formatKilograms(topCrop[1])} delivered` : "No deliveries yet"} />
      <SummaryCard label="Farmers delivering" value={String(farmersDelivering)} detail={farmers.length ? `of ${farmers.length} registered farmers` : "No farmers yet"} />
      <SummaryCard label="Rejected deliveries" value={String(rejected)} detail={deliveries.length ? `${Math.round((rejected / deliveries.length) * 100)}% of deliveries` : "No deliveries yet"} />
    </div>

    <QueuedRecords kinds={["RECORD_DELIVERY"]} title="deliveries" userId={user.id} />
    <div className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-[var(--kinja-green)]">All deliveries</h2><p className="mt-1 text-sm text-[#5d685e]">{deliveries.length} {deliveries.length === 1 ? "delivery" : "deliveries"}</p></div><Link className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white" href="/dashboard/cooperative/deliveries/new"><Plus size={17} aria-hidden="true" />Record delivery</Link></div>

    {allDeliveries.length === 0 ? (
      <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 px-6 py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7eee4] text-[var(--kinja-green)]"><ClipboardList size={22} aria-hidden="true" /></span><p className="mt-4 font-semibold text-[var(--kinja-green)]">No deliveries recorded yet</p><p className="mt-1 max-w-sm text-sm text-[#5d685e]">Record a delivery when a farmer brings produce, so the amount they are owed is tracked.</p></div>
    ) : (
      <DataTable muted={(delivery) => Boolean(delivery.voidedAt)} rowKey={(delivery) => delivery.id} rows={allDeliveries} columns={[
        { header: "Date", cell: (delivery) => formatDate(delivery.createdAt) },
        { header: "Farmer", cell: (delivery) => { const farmer = farmersById.get(delivery.farmerId); return <span className="flex items-center gap-3">{farmer && <Avatar className="h-8 w-8" name={farmer.fullName} photoUrl={farmer.photoUrl} seed={farmer.id} />}<span className="font-semibold text-[var(--kinja-green)]">{farmer?.fullName ?? "Unknown farmer"}</span></span>; } },
        { header: "Crop", cell: (delivery) => cropsById.get(delivery.cropId)?.name ?? delivery.cropId },
        { header: "Grade", cell: (delivery) => <span className={delivery.priceMinorPerKg === 0 ? "text-[#b42318]" : undefined}>{gradeName(delivery.cropId, delivery.gradeId)}</span> },
        { header: "Weight", align: "right", cell: (delivery) => formatKilograms(kilogramsToGrams(delivery.kilograms)) },
        ...moneyColumns(money, "Price per kg", (delivery: (typeof allDeliveries)[number]) => moneyItem(delivery.priceMinorPerKg, currency, delivery.createdAt)),
        ...moneyColumns(money, "Amount owed", (delivery: (typeof allDeliveries)[number]) => moneyItem(delivery.amountOwedMinor, currency, delivery.createdAt), { strong: true }),
        { header: "Status", cell: (delivery) => delivery.voidedAt ? <Badge tone="grey">Voided</Badge> : <Badge tone="green">Recorded</Badge> },
      ]} />
    )}
  </CooperativeShell>;
}
