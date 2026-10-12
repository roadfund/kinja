import { Plus } from "lucide-react";
import { ExportLinks } from "@/components/ops/export-links";
import { requireCooperativeMember } from "@/auth/route-authorization";
import { DashboardShell, LinkButton, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { TransferTable, transferSummary } from "@/components/manufacture/transfer-table";
import { listTransfers } from "@/manufacture/manufacture-service";
import { redirect } from "next/navigation";

export default async function CooperativeTransfersPage() {
  const account = await requireCooperativeMember();
  if (account.scope.role !== "COOP_LEAD") redirect("/dashboard/cooperative");
  const { transfers } = await listTransfers(account);
  const summary = transferSummary(transfers);
  return <DashboardShell actions={<ExportLinks datasets={["transfers"]} />} eyebrow="Kinja Manufacture" title="Transfers" description="Raw material your cooperative has sent to manufacturers, and what they confirmed receiving.">
    <SummaryGrid>
      <SummaryCard detail="Sent to manufacturers" label="Transfers" value={summary.total} />
      <SummaryCard detail="Waiting for the manufacturer" label="In transit" value={summary.inTransit} />
      <SummaryCard detail="Confirmed by the manufacturer" label="Received" value={summary.received} />
      <SummaryCard detail="Received amount differs from sent" label="Discrepancies" tone={summary.discrepancies ? "warning" : undefined} value={summary.discrepancies} />
    </SummaryGrid>
    <SectionHeader action={<LinkButton href="/dashboard/cooperative/transfers/new" icon={<Plus size={17} aria-hidden="true" />}>Send raw material</LinkButton>} description={`${transfers.length} ${transfers.length === 1 ? "transfer" : "transfers"}`} title="All transfers" />
    <TransferTable emptyText="Send raw material to a manufacturer, linked to the deliveries it came from." transfers={transfers} />
  </DashboardShell>;
}
