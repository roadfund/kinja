import Link from "next/link";
import { requireDashboardRole } from "@/auth/route-authorization";
import { Badge, DashboardShell, formatDate, SectionHeader, SummaryCard, SummaryGrid, type BadgeTone } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { ReasonAction } from "@/components/ops/reason-action";
import type { Hub } from "@/domain/model";
import { listHubsForModeration } from "@/ops/moderation";

const hubStatus: Record<Hub["status"], [string, BadgeTone]> = { PENDING_VERIFICATION: ["Pending", "amber"], VERIFIED: ["Verified", "green"], REJECTED: ["Rejected", "grey"], SUSPENDED: ["Suspended", "red"] };

export default async function ModerationPage() {
  const account = await requireDashboardRole(["TECH_ADMIN"]);
  const hubs = await listHubsForModeration(account);
  return <DashboardShell eyebrow="Kinja Ops" title="Hubs and moderation" description="Every hub on the platform. Suspend a hub, organization or user, or void records with a logged reason.">
    <SummaryGrid>
      <SummaryCard detail="On the platform" label="Hubs" value={hubs.length} />
      <SummaryCard detail="Operating" label="Verified" value={hubs.filter((hub) => hub.status === "VERIFIED").length} />
      <SummaryCard detail="Waiting for review" label="Pending" tone={hubs.some((hub) => hub.status === "PENDING_VERIFICATION") ? "warning" : undefined} value={hubs.filter((hub) => hub.status === "PENDING_VERIFICATION").length} />
      <SummaryCard detail="Access blocked" label="Suspended" value={hubs.filter((hub) => hub.status === "SUSPENDED").length} />
    </SummaryGrid>
    <SectionHeader title="All hubs" />
    <DataTable rowKey={(hub) => hub.id} rows={hubs} columns={[
      { header: "Hub", cell: (hub) => <Link className="font-semibold text-[var(--kinja-green)] hover:underline" href={`/admin/moderation/${hub.id}`}>{hub.businessName}</Link> },
      { header: "Region", cell: (hub) => hub.regionOrCounty },
      { header: "Organizations", align: "right", cell: (hub) => hub.organizations },
      { header: "Members", align: "right", cell: (hub) => hub.members },
      { header: "Farmers", align: "right", cell: (hub) => hub.farmers },
      { header: "Created", cell: (hub) => formatDate(hub.createdAt) },
      { header: "Status", cell: (hub) => <Badge tone={hubStatus[hub.status][1]}>{hubStatus[hub.status][0]}</Badge> },
      { header: "Action", cell: (hub) => hub.status === "VERIFIED" ? <ReasonAction body={{ suspend: true }} confirmLabel="Suspend hub" description={`Everyone in ${hub.businessName} loses access until it is reinstated.`} endpoint={`/ops/moderation/hubs/${hub.id}`} title={`Suspend ${hub.businessName}?`} triggerLabel="Suspend" /> : hub.status === "SUSPENDED" ? <ReasonAction body={{ suspend: false }} confirmLabel="Reinstate hub" description="Members regain access straight away." destructive={false} endpoint={`/ops/moderation/hubs/${hub.id}`} title={`Reinstate ${hub.businessName}?`} triggerLabel="Reinstate" /> : hub.status === "PENDING_VERIFICATION" ? <Link className="text-sm font-semibold text-[var(--kinja-green)] underline" href="/admin/hubs">Review</Link> : null },
    ]} />
  </DashboardShell>;
}
