import Link from "next/link";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { formatDate, SectionHeader } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { DismissDuplicateButton } from "@/components/field/dismiss-duplicate-button";
import { SyncQueue } from "@/components/field/sync-queue";
import { listFarmers } from "@/field/farmers";
import { CooperativeShell } from "../cooperative-shell";

export default async function SyncPage() {
  const { user, scope } = await requireCooperativeMember();
  const farmers = await listFarmers(scope.hubId, scope.organizationId);
  const flagged = scope.role === "COOP_LEAD" ? farmers.filter((farmer) => farmer.possibleDuplicateOf?.length) : [];
  const name = (id: string) => farmers.find((farmer) => farmer.id === id)?.fullName ?? "Removed farmer";
  return <CooperativeShell eyebrow="Kinja Field" title="Sync status" description="Farmers and deliveries are saved on this device first, then synced to Kinja. You can keep working offline.">
    <SyncQueue userId={user.id} />
    {scope.role === "COOP_LEAD" && <>
      <SectionHeader description="Records synced from a device that look like a farmer already registered. Nothing is merged automatically." title="Possible duplicate farmers" />
      {flagged.length === 0 ? <p className="mt-3 text-sm text-[#5d685e]">No possible duplicates to review.</p> :
        <DataTable rowKey={(farmer) => farmer.id} rows={flagged} columns={[
          { header: "New record", cell: (farmer) => <Link className="font-semibold text-[var(--kinja-green)] hover:underline" href={`/dashboard/cooperative/farmers/${farmer.id}`}>{farmer.fullName}</Link> },
          { header: "Community", cell: (farmer) => farmer.community },
          { header: "Phone", cell: (farmer) => farmer.phone ?? "—" },
          { header: "Registered", cell: (farmer) => formatDate(farmer.createdAt) },
          { header: "Looks like", cell: (farmer) => <span className="flex flex-wrap gap-2">{farmer.possibleDuplicateOf!.map((id) => <Link className="underline" href={`/dashboard/cooperative/farmers/${id}`} key={id}>{name(id)}</Link>)}</span> },
          { header: "Action", cell: (farmer) => <DismissDuplicateButton farmerId={farmer.id} /> },
        ]} />}
    </>}
  </CooperativeShell>;
}
