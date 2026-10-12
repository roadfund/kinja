import { Plus } from "lucide-react";
import { ExportLinks } from "@/components/ops/export-links";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, LinkButton, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { TransferTable, transferSummary } from "@/components/manufacture/transfer-table";
import { listTransfers } from "@/manufacture/manufacture-service";

export default async function ManufacturerTransfersPage() {
  const account = await requireOrganizationMember(["MANUFACTURER"], "MANUFACTURER");
  const { transfers } = await listTransfers(account);
  const incoming = transfers.filter((transfer) => transfer.direction === "IN");
  const outgoing = transfers.filter((transfer) => transfer.direction === "OUT");
  const summary = transferSummary(transfers);
  return <DashboardShell actions={<ExportLinks datasets={["transfers"]} />} eyebrow="Kinja Manufacture" title="Transfers" description="Raw material arriving from cooperatives, and finished goods you send to distributors.">
    <SummaryGrid>
      <SummaryCard detail="Raw material waiting for you" label="To confirm" tone={incoming.some((transfer) => transfer.status === "SENT" && !transfer.voidedAt) ? "warning" : undefined} value={incoming.filter((transfer) => transfer.status === "SENT" && !transfer.voidedAt).length} />
      <SummaryCard detail="From cooperatives" label="Incoming" value={incoming.length} />
      <SummaryCard detail="To distributors" label="Outgoing" value={outgoing.length} />
      <SummaryCard detail="Received amount differs from sent" label="Discrepancies" tone={summary.discrepancies ? "warning" : undefined} value={summary.discrepancies} />
    </SummaryGrid>
    <SectionHeader description="Confirm the kg that actually arrived" title="Incoming raw material" />
    <TransferTable canReceive emptyText="Raw material sent to you by cooperatives appears here." transfers={incoming} />
    <SectionHeader action={<LinkButton href="/dashboard/manufacturer/transfers/new" icon={<Plus size={17} aria-hidden="true" />}>Send finished goods</LinkButton>} description="Finished goods sent to distributors" title="Outgoing" />
    <TransferTable emptyText="Send finished goods from a batch to a distributor." transfers={outgoing} />
  </DashboardShell>;
}
