import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { TransferTable, transferSummary } from "@/components/manufacture/transfer-table";
import { ExportLinks } from "@/components/ops/export-links";
import { listBatches, listTransfers } from "@/manufacture/manufacture-service";
import { ManufactureTabs } from "./tabs";

export default async function HubTransfersPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const [{ transfers }, batches] = await Promise.all([listTransfers(account), listBatches(account)]);
  const summary = transferSummary(transfers);
  const discrepancies = transfers.filter((transfer) => transfer.hasDiscrepancy && !transfer.voidedAt);
  return <DashboardShell actions={<ExportLinks datasets={["transfers"]} />} eyebrow="Kinja Manufacture" title="Transfers" description="Goods moving between organizations in your hub. Discrepancies are shown to both sides and to you.">
    <ManufactureTabs active="Transfers" counts={{ transfers: transfers.length, batches: batches.length }} />
    <SummaryGrid>
      <SummaryCard detail="Between organizations" label="Transfers" value={summary.total} />
      <SummaryCard detail="Waiting for the receiver" label="In transit" value={summary.inTransit} />
      <SummaryCard detail="Confirmed by the receiver" label="Received" value={summary.received} />
      <SummaryCard detail="Received differs from sent" label="Discrepancies" tone={discrepancies.length ? "warning" : undefined} value={discrepancies.length} />
    </SummaryGrid>
    {discrepancies.length > 0 && <><SectionHeader description="Follow these up with both organizations" title="Discrepancies" /><TransferTable emptyText="" transfers={discrepancies} /></>}
    <SectionHeader title="All transfers" />
    <TransferTable emptyText="Transfers appear when cooperatives send raw material or manufacturers ship finished goods." transfers={transfers} />
  </DashboardShell>;
}
