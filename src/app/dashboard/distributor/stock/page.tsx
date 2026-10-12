import { Boxes } from "lucide-react";
import { ExportLinks } from "@/components/ops/export-links";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { DashboardShell, DataTable, EmptyState, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { TransferTable, transferSummary } from "@/components/manufacture/transfer-table";
import { formatQuantity } from "@/domain/money";
import { listTransfers } from "@/manufacture/manufacture-service";
import { distributorStock } from "@/market/market-service";

export default async function DistributorStockPage() {
  const account = await requireOrganizationMember(["DISTRIBUTOR"], "DISTRIBUTOR");
  const [{ transfers }, stock] = await Promise.all([listTransfers(account), distributorStock(account.scope.hubId, account.scope.organizationId)]);
  const summary = transferSummary(transfers);
  return <DashboardShell actions={<ExportLinks datasets={["stock", "transfers"]} />} eyebrow="Kinja Market" title="Stock and shipments" description="Finished goods sent to you by manufacturers, and what you still hold from each batch.">
    <SummaryGrid>
      <SummaryCard detail="Shipments waiting for you" label="To confirm" tone={summary.inTransit ? "warning" : undefined} value={summary.inTransit} />
      <SummaryCard detail="Confirmed shipments" label="Received" value={summary.received} />
      <SummaryCard detail="With stock available" label="Batches" value={stock.filter((row) => row.availableThousandths > 0).length} />
      <SummaryCard detail="Received amount differs from sent" label="Discrepancies" tone={summary.discrepancies ? "warning" : undefined} value={summary.discrepancies} />
    </SummaryGrid>
    <SectionHeader description="Confirm what actually arrived" title="Incoming shipments" />
    <TransferTable canReceive emptyText="Finished goods sent to you by manufacturers appear here." transfers={transfers} />
    <SectionHeader description="Received minus sold, per batch" title="Stock on hand" />
    {stock.length === 0 ? <EmptyState description="Stock appears once you confirm a shipment." icon={<Boxes size={22} aria-hidden="true" />} title="No stock yet" /> :
      <DataTable rowKey={(row) => row.batchId} rows={stock} columns={[
        { header: "Product", cell: (row) => <span className="font-medium text-[#344e41]">{row.productName}</span> },
        { header: "Batch", cell: (row) => row.batchLabel },
        { header: "Received", align: "right", cell: (row) => formatQuantity(row.receivedThousandths, row.unit) },
        { header: "Sold", align: "right", cell: (row) => formatQuantity(row.soldThousandths, row.unit) },
        { header: "Available", align: "right", cell: (row) => <span className="font-semibold text-[var(--kinja-green)]">{formatQuantity(row.availableThousandths, row.unit)}</span> },
      ]} />}
  </DashboardShell>;
}
