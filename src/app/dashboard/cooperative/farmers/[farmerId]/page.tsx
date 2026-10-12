import { MapPin, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { Avatar } from "@/components/avatar";
import { getMoneyContext } from "@/admin/exchange-rates";
import { moneyColumns } from "@/components/kinja/money";
import { Badge, DataTable } from "@/components/kinja/ui";
import { moneyItem, moneyLines } from "@/domain/currency";
import { formatKilograms, kilogramsToGrams } from "@/domain/money";
import { listDeliveries, listHubCropOptions } from "@/field/deliveries";
import { getFarmer } from "@/field/farmers";
import { CooperativeShell } from "../../cooperative-shell";

const ACRES_PER_HECTARE = 2.471;
const statusLabels = { ALREADY_GROWS: "Already grows", CURRENTLY_GROWING: "Currently growing", WANTS_TO_GROW: "Wants to grow" } as const;
const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function SummaryCard({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">{label}</p><p className="mt-2 truncate text-3xl font-semibold text-[var(--kinja-green)]">{value}</p><p className="mt-1 text-sm text-[#5d685e]">{detail}</p></div>;
}

function Detail({ label, value }: { label: string; value?: string }) {
  return <div><dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#718074]">{label}</dt><dd className={`mt-1 ${value ? "text-[#344e41]" : "text-[#9aa69c]"}`}>{value || "Not recorded"}</dd></div>;
}


export default async function FarmerPage({ params }: { params: Promise<{ farmerId: string }> }) {
  const { scope, hub } = await requireCooperativeMember();
  const farmer = await getFarmer((await params).farmerId, { hubId: scope.hubId, cooperativeId: scope.organizationId });
  if (!farmer) notFound();

  const [allDeliveries, crops] = await Promise.all([listDeliveries(scope.hubId, scope.organizationId), listHubCropOptions(scope.hubId)]);
  const money = await getMoneyContext(hub!);
  const farmerDeliveries = allDeliveries.filter((delivery) => delivery.farmerId === farmer.id);
  const deliveries = farmerDeliveries.filter((delivery) => !delivery.voidedAt);
  const cropsById = new Map(crops.map((crop) => [crop.cropId, crop]));
  const currency = crops[0]?.currency ?? "LRD";
  const totalGrams = deliveries.reduce((sum, delivery) => sum + kilogramsToGrams(delivery.kilograms), 0);
  const totalOwed = deliveries.map((delivery) => moneyItem(delivery.amountOwedMinor, currency, delivery.createdAt));
  const acres = farmer.plots.reduce((sum, plot) => sum + (plot.unit === "HECTARES" ? plot.size * ACRES_PER_HECTARE : plot.size), 0);
  const plotName = (plotId?: string) => farmer.plots.find((plot) => plot.id === plotId)?.description;

  return <CooperativeShell back={{ href: "/dashboard/cooperative/farmers", label: "Farmers" }} eyebrow="Farmer" title={farmer.fullName} description={`Registered ${formatDate(farmer.createdAt)}${farmer.updatedAt !== farmer.createdAt ? ` · Updated ${formatDate(farmer.updatedAt)}` : ""}`}>
    {farmer.possibleDuplicateOf?.length ? <p className="mb-4 rounded-xl border border-[#e4d9aa] bg-[#fff9e8] px-4 py-3 text-sm text-[#6d5a1d]">This farmer may already be registered. A coop lead can review it on the <Link className="font-semibold underline" href="/dashboard/cooperative/sync">Sync status</Link> page.</p> : null}<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5">
      <div className="flex items-center gap-4"><Avatar className="h-16 w-16" name={farmer.fullName} photoUrl={farmer.photoUrl} seed={farmer.id} /><div><p className="flex items-center gap-1.5 text-[#5d685e]"><MapPin size={15} aria-hidden="true" />{farmer.community}</p><p className="mt-1 flex items-center gap-1.5 text-[#5d685e]"><Phone size={15} aria-hidden="true" />{farmer.phone ?? "No phone"}</p></div></div>
      <Link className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cbd2c9] bg-white px-5 font-semibold text-[var(--kinja-green)]" href={`/dashboard/cooperative/farmers/${farmer.id}/edit`}><Pencil size={16} aria-hidden="true" />Edit farmer</Link>
    </div>

    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Deliveries" value={String(deliveries.length)} detail={deliveries[0] ? `Last on ${formatDate(deliveries[0].createdAt)}` : "None yet"} />
      <SummaryCard label="Total delivered" value={formatKilograms(totalGrams)} detail="Across all deliveries" />
      {moneyLines(money, totalOwed).map((line) => <SummaryCard detail="Before payouts" key={line.currency} label={`Amount owed · ${line.currency}`} value={line.text} />)}
      <SummaryCard label="Farmland" value={`${acres.toFixed(1)} ac`} detail={`${farmer.plots.length} ${farmer.plots.length === 1 ? "plot" : "plots"}`} />
    </div>

    <section className="mt-4 rounded-2xl bg-white p-6"><h2 className="font-semibold text-[var(--kinja-green)]">Personal details</h2>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Gender" value={titleCase(farmer.gender)} /><Detail label="Age" value={String(farmer.age)} /><Detail label="Date of birth" value={farmer.dateOfBirth && formatDate(farmer.dateOfBirth)} /><Detail label="Main income source" value={farmer.incomeSource} /><Detail label="Mobile money number" value={farmer.mobileMoneyNumber} />
        <Detail label="Household size" value={farmer.householdSize?.toString()} /><Detail label="Dependents" value={farmer.dependents?.toString()} /><Detail label="Head of household" value={farmer.headOfHousehold === undefined ? undefined : farmer.headOfHousehold ? "Yes" : "No"} />
      </dl>
    </section>

    <h2 className="mt-8 text-lg font-semibold text-[var(--kinja-green)]">Top crops</h2>
    <DataTable rowKey={(crop) => crop.crop} rows={farmer.topCrops} columns={[
      { header: "Rank", cell: (crop) => `#${farmer.topCrops.indexOf(crop) + 1}` },
      { header: "Crop", cell: (crop) => <span className="font-medium text-[#344e41]">{crop.crop}</span> },
      { header: "Status", cell: (crop) => statusLabels[crop.status] },
    ]} />

    <h2 className="mt-8 text-lg font-semibold text-[var(--kinja-green)]">Farm plots</h2>
    <DataTable rowKey={(plot) => plot.id ?? plot.description} rows={farmer.plots} columns={[
      { header: "Plot", cell: (plot) => <span className="font-medium text-[#344e41]">{plot.description}</span> },
      { header: "Village", cell: (plot) => plot.village },
      { header: "Size", align: "right", cell: (plot) => String(plot.size) },
      { header: "Unit", cell: (plot) => plot.unit === "HECTARES" ? "Hectares" : "Acres" },
      { header: "Tenure", cell: (plot) => titleCase(plot.tenure) },
      { header: "Crops", cell: (plot) => plot.crops.map((crop) => (crop === "Other" ? plot.otherCrop : crop)).join(", ") || "—" },
      { header: "GPS", cell: (plot) => { const [lat, lon] = plot.gps?.split(", ") ?? []; return plot.gps ? <a className="text-[var(--kinja-green)] underline" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`} rel="noreferrer" target="_blank">View map</a> : "—"; } },
    ]} />

    <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[var(--kinja-green)]">Deliveries</h2><Link className="text-sm font-semibold text-[var(--kinja-green)] underline" href="/dashboard/cooperative/deliveries/new">Record a delivery</Link></div>
    {farmerDeliveries.length === 0 ? <p className="mt-3 text-sm text-[#5d685e]">No deliveries recorded for this farmer yet.</p> :
      <DataTable muted={(delivery) => Boolean(delivery.voidedAt)} rowKey={(delivery) => delivery.id} rows={farmerDeliveries} columns={[
        { header: "Date", cell: (delivery) => formatDate(delivery.createdAt) },
        { header: "Crop", cell: (delivery) => cropsById.get(delivery.cropId)?.name ?? delivery.cropId },
        { header: "Grade", cell: (delivery) => <span className={delivery.priceMinorPerKg === 0 ? "text-[#b42318]" : undefined}>{cropsById.get(delivery.cropId)?.grades.find((grade) => grade.gradeId === delivery.gradeId)?.name ?? delivery.gradeId}</span> },
        { header: "Plot", cell: (delivery) => plotName(delivery.plotId) ?? "—" },
        { header: "Weight", align: "right", cell: (delivery) => formatKilograms(kilogramsToGrams(delivery.kilograms)) },
        ...moneyColumns(money, "Amount owed", (delivery: (typeof farmerDeliveries)[number]) => moneyItem(delivery.amountOwedMinor, currency, delivery.createdAt), { strong: true }),
        { header: "Status", cell: (delivery) => delivery.voidedAt ? <Badge tone="grey">Voided</Badge> : <Badge tone="green">Recorded</Badge> },
      ]} />}
  </CooperativeShell>;
}
