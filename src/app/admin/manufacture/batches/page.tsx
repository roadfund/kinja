import { Factory } from "lucide-react";
import { requireDashboardRole } from "@/auth/route-authorization";
import { Badge, DashboardShell, DataTable, EmptyState, formatDate, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { ExportLinks } from "@/components/ops/export-links";
import { formatQuantity, toThousandths } from "@/domain/money";
import { listBatches, listTransfers, yieldPercent } from "@/manufacture/manufacture-service";
import { ManufactureTabs } from "../tabs";

export default async function HubBatchesPage() {
  const account = await requireDashboardRole(["HUB_ADMIN"]);
  const [{ transfers }, batches] = await Promise.all([listTransfers(account), listBatches(account)]);
  const live = batches.filter((batch) => !batch.voidedAt);
  const input = live.reduce((sum, batch) => sum + toThousandths(batch.inputKg), 0);
  const wastage = live.reduce((sum, batch) => sum + toThousandths(batch.wastageKg), 0);
  const kgYields = live.filter((batch) => batch.unit === "KG").map((batch) => yieldPercent(batch)).filter((value): value is number => value !== null);
  return <DashboardShell actions={<ExportLinks datasets={["stock"]} />} eyebrow="Kinja Manufacture" title="Batches" description="Production runs by your manufacturers, with yield, wastage and stock left.">
    <ManufactureTabs active="Batches" counts={{ transfers: transfers.length, batches: batches.length }} />
    <SummaryGrid>
      <SummaryCard detail={`${live.filter((batch) => batch.remainingThousandths > 0).length} with stock left`} label="Batches" value={live.length} />
      <SummaryCard detail="Raw material processed" label="Input" value={formatQuantity(input, "KG")} />
      <SummaryCard detail={input ? `${((wastage / input) * 100).toFixed(1)}% of input` : "No batches yet"} label="Wastage" value={formatQuantity(wastage, "KG")} />
      <SummaryCard detail="Batches measured in kg" label="Average yield" value={kgYields.length ? `${(kgYields.reduce((a, b) => a + b, 0) / kgYields.length).toFixed(1)}%` : "—"} />
    </SummaryGrid>
    {batches.length === 0 ? <EmptyState description="Batches recorded by your manufacturers appear here." icon={<Factory size={22} aria-hidden="true" />} title="No batches yet" /> :
      <DataTable muted={(batch) => Boolean(batch.voidedAt)} rowKey={(batch) => batch.id} rows={batches} columns={[
        { header: "Batch", cell: (batch) => <span className="font-semibold text-[var(--kinja-green)]">{batch.label}</span> },
        { header: "Manufacturer", cell: (batch) => batch.organizationName },
        { header: "Produced", cell: (batch) => formatDate(batch.producedAt) },
        { header: "Product", cell: (batch) => batch.productName },
        { header: "Input", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.inputKg), "KG") },
        { header: "Output", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.quantityProduced), batch.unit) },
        { header: "Wastage", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.wastageKg), "KG") },
        { header: "Yield", align: "right", cell: (batch) => batch.yieldLabel },
        { header: "Left", align: "right", cell: (batch) => formatQuantity(batch.remainingThousandths, batch.unit) },
        { header: "Status", cell: (batch) => batch.voidedAt ? <Badge tone="grey">Voided</Badge> : batch.remainingThousandths > 0 ? <Badge tone="green">In stock</Badge> : <Badge tone="neutral">All sent</Badge> },
      ]} />}
  </DashboardShell>;
}
