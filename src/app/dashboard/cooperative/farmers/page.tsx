import { Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { listFarmers, type Farmer } from "@/field/farmers";
import { Avatar } from "@/components/avatar";
import { Badge, DataTable, formatDate } from "@/components/kinja/ui";
import { ExportLinks } from "@/components/ops/export-links";
import { QueuedRecords } from "@/components/field/queued-records";
import { CooperativeShell } from "../cooperative-shell";

const ACRES_PER_HECTARE = 2.471;
const statusLabels: Record<Farmer["topCrops"][number]["status"], string> = { ALREADY_GROWS: "Already grows", CURRENTLY_GROWING: "Currently growing", WANTS_TO_GROW: "Wants to grow" };

function totalAcres(farmers: Farmer[]): number {
  return farmers.flatMap((farmer) => farmer.plots).reduce((sum, plot) => sum + (plot.unit === "HECTARES" ? plot.size * ACRES_PER_HECTARE : plot.size), 0);
}

function mostGrownCrop(farmers: Farmer[]): { crop: string; growers: number } | null {
  const growers = new Map<string, number>();
  for (const farmer of farmers) {
    for (const { crop, status } of farmer.topCrops) if (status !== "WANTS_TO_GROW") growers.set(crop, (growers.get(crop) ?? 0) + 1);
  }
  const [top] = [...growers].sort((a, b) => b[1] - a[1]);
  return top ? { crop: top[0], growers: top[1] } : null;
}

const share = (count: number, total: number) => (total ? `${Math.round((count / total) * 100)}% of farmers` : "No farmers yet");

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">{label}</p><p className="mt-2 text-3xl font-semibold text-[var(--kinja-green)]">{value}</p><p className="mt-1 text-sm text-[#5d685e]">{detail}</p></div>;
}

const addFarmerButton = <Link className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white" href="/dashboard/cooperative/farmers/new"><Plus size={17} aria-hidden="true" />Register farmer</Link>;

export default async function FarmersPage() {
  const { scope, user } = await requireCooperativeMember();
  const farmers = (await listFarmers(scope.hubId, scope.organizationId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const women = farmers.filter((farmer) => farmer.gender === "FEMALE").length;
  const men = farmers.filter((farmer) => farmer.gender === "MALE").length;
  const topCrop = mostGrownCrop(farmers);
  const plots = farmers.reduce((sum, farmer) => sum + farmer.plots.length, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newThisMonth = farmers.filter((farmer) => farmer.createdAt.startsWith(thisMonth)).length;

  return <CooperativeShell actions={<ExportLinks datasets={["farmers"]} />} eyebrow="Kinja Field" title="Farmers" description="Everyone registered with your cooperative, with their crops and farm plots.">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SummaryCard label="Farmers" value={String(farmers.length)} detail={`${newThisMonth} registered this month`} />
      <SummaryCard label="Women farmers" value={String(women)} detail={share(women, farmers.length)} />
      <SummaryCard label="Men farmers" value={String(men)} detail={share(men, farmers.length)} />
      <SummaryCard label="Most grown crop" value={topCrop?.crop ?? "—"} detail={topCrop ? `Grown by ${topCrop.growers} ${topCrop.growers === 1 ? "farmer" : "farmers"}` : "No crops recorded yet"} />
      <SummaryCard label="Farm plots" value={String(plots)} detail={farmers.length ? `${(plots / farmers.length).toFixed(1)} per farmer` : "No plots yet"} />
      <SummaryCard label="Farmland" value={`${totalAcres(farmers).toFixed(1)} ac`} detail="Approximate total area" />
    </div>

    <QueuedRecords kinds={["CREATE_FARMER", "UPDATE_FARMER"]} title="farmer records" userId={user.id} />
    <div className="mt-10 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-[var(--kinja-green)]">All farmers</h2><p className="mt-1 text-sm text-[#5d685e]">{farmers.length} {farmers.length === 1 ? "farmer" : "farmers"}</p></div>{addFarmerButton}</div>

    {farmers.length === 0 ? (
      <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 px-6 py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e7eee4] text-[var(--kinja-green)]"><UsersRound size={22} aria-hidden="true" /></span><p className="mt-4 font-semibold text-[var(--kinja-green)]">No farmers registered yet</p><p className="mt-1 max-w-sm text-sm text-[#5d685e]">Register your first farmer to start tracking their crops, plots and deliveries.</p></div>
    ) : (
      <DataTable rowKey={(farmer) => farmer.id} rows={farmers} columns={[
        { header: "Farmer", cell: (farmer) => <span className="flex items-center gap-3"><Avatar name={farmer.fullName} photoUrl={farmer.photoUrl} seed={farmer.id} /><Link className="font-semibold text-[var(--kinja-green)] hover:underline" href={`/dashboard/cooperative/farmers/${farmer.id}`}>{farmer.fullName}</Link></span> },
        { header: "Phone", cell: (farmer) => farmer.phone ?? "—" },
        { header: "Community", cell: (farmer) => farmer.community },
        { header: "Top crop", cell: (farmer) => <span className="font-medium text-[#344e41]">{farmer.topCrops[0].crop}</span> },
        { header: "Crop status", cell: (farmer) => statusLabels[farmer.topCrops[0].status] },
        { header: "Plots", align: "right", cell: (farmer) => farmer.plots.length },
        { header: "Registered", cell: (farmer) => formatDate(farmer.createdAt) },
        { header: "Duplicate check", cell: (farmer) => farmer.possibleDuplicateOf?.length ? <Badge tone="amber">Possible duplicate</Badge> : "—" },
      ]} />
    )}
  </CooperativeShell>;
}
