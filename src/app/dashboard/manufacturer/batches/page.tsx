import { Factory, Plus } from "lucide-react";
import { ExportLinks } from "@/components/ops/export-links";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { Badge, DashboardShell, EmptyState, formatDate, LinkButton, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { formatQuantity, toThousandths } from "@/domain/money";
import { listBatches, yieldPercent } from "@/manufacture/manufacture-service";

export default async function BatchesPage() {
  const account = await requireOrganizationMember(["MANUFACTURER"], "MANUFACTURER");
  const batches = await listBatches(account);
  const live = batches.filter((batch) => !batch.voidedAt);
  const inputKg = live.reduce((sum, batch) => sum + toThousandths(batch.inputKg), 0);
  const wastage = live.reduce((sum, batch) => sum + toThousandths(batch.wastageKg), 0);
  const kgYields = live.filter((batch) => batch.unit === "KG").map((batch) => yieldPercent(batch)).filter((value): value is number => value !== null);
  return <DashboardShell actions={<ExportLinks datasets={["stock"]} />} eyebrow="Kinja Manufacture" title="Batches" description="Production runs, the raw material each one used, and what is left to send.">
    <SummaryGrid>
      <SummaryCard detail={`${live.filter((batch) => batch.remainingThousandths > 0).length} with stock left`} label="Batches" value={live.length} />
      <SummaryCard detail="Raw material used" label="Input" value={formatQuantity(inputKg, "KG")} />
      <SummaryCard detail={inputKg ? `${((wastage / inputKg) * 100).toFixed(1)}% of input` : "No batches yet"} label="Wastage" value={formatQuantity(wastage, "KG")} />
      <SummaryCard detail="Across batches measured in kg" label="Average yield" value={kgYields.length ? `${(kgYields.reduce((a, b) => a + b, 0) / kgYields.length).toFixed(1)}%` : "—"} />
    </SummaryGrid>
    <SectionHeader action={<LinkButton href="/dashboard/manufacturer/batches/new" icon={<Plus size={17} aria-hidden="true" />}>New batch</LinkButton>} description={`${batches.length} ${batches.length === 1 ? "batch" : "batches"}`} title="All batches" />
    {batches.length === 0 ? <EmptyState description="Record a batch when you process received raw material into a product." icon={<Factory size={22} aria-hidden="true" />} title="No batches yet" /> :
      <DataTable muted={(batch) => Boolean(batch.voidedAt)} rowKey={(batch) => batch.id} rows={batches} columns={[
        { header: "Batch", cell: (batch) => <span className="font-semibold text-[var(--kinja-green)]">{batch.label}</span> },
        { header: "Produced", cell: (batch) => formatDate(batch.producedAt) },
        { header: "Product", cell: (batch) => <span className="text-[#344e41]">{batch.productName}</span> },
        { header: "Input", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.inputKg), "KG") },
        { header: "Output", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.quantityProduced), batch.unit) },
        { header: "Wastage", align: "right", cell: (batch) => formatQuantity(toThousandths(batch.wastageKg), "KG") },
        { header: "Yield", align: "right", cell: (batch) => batch.yieldLabel },
        { header: "Sent", align: "right", cell: (batch) => formatQuantity(batch.sentThousandths, batch.unit) },
        { header: "Left", align: "right", cell: (batch) => <span className="font-semibold text-[#344e41]">{formatQuantity(batch.remainingThousandths, batch.unit)}</span> },
        { header: "Status", cell: (batch) => batch.voidedAt ? <Badge tone="grey">Voided</Badge> : batch.remainingThousandths > 0 ? <Badge tone="green">In stock</Badge> : <Badge tone="neutral">All sent</Badge> },
      ]} />}
  </DashboardShell>;
}
