import { Boxes, Factory, Truck } from "lucide-react";
import { requireOrganizationMember } from "@/auth/route-authorization";
import { ChartCard, ColumnChart, compactNumber, GREEN, GREEN_LIGHT, monthBuckets, StackedBarChart } from "@/components/charts/charts";
import { ReportTable } from "@/components/market/order-dashboard";
import { formatQuantity, toThousandths } from "@/domain/money";
import { listBatches, listTransfers } from "@/manufacture/manufacture-service";
import { RoleDashboard } from "../role-dashboard";

export default async function ManufacturerDashboard() {
  const account = await requireOrganizationMember(["MANUFACTURER"], "MANUFACTURER");
  const [{ transfers }, batches] = await Promise.all([listTransfers(account), listBatches(account)]);
  const toConfirm = transfers.filter((transfer) => transfer.direction === "IN" && transfer.status === "SENT" && !transfer.voidedAt).length;
  const inStock = batches.filter((batch) => batch.remainingThousandths > 0).length;
  // Raw material this manufacturer received, by the month it arrived.
  const received = transfers.filter((transfer) => transfer.direction === "IN" && transfer.kind === "RAW_MATERIAL" && transfer.status === "RECEIVED" && !transfer.voidedAt && toThousandths(transfer.quantityReceived ?? "0") > 0);
  const kg = (thousandths: number) => formatQuantity(thousandths, "KG");
  const perMonth = monthBuckets(received, (transfer) => transfer.receivedAt ?? transfer.createdAt).map((bucket) => { const total = bucket.items.reduce((sum, transfer) => sum + toThousandths(transfer.quantityReceived!), 0); return { key: bucket.key, axisLabel: bucket.axisLabel, value: total, count: bucket.items.length, tip: { title: bucket.title, rows: [["Received", kg(total)], ["Transfers", String(bucket.items.length)]] as Array<[string, string]> } }; });
  const liveBatches = batches.filter((batch) => !batch.voidedAt).slice(0, 12);
  // Kilograms and units never share one scale: one chart per unit.
  const batchGroups = (["UNIT", "KG"] as const).map((unit) => ({ unit, batches: liveBatches.filter((batch) => batch.unit === unit) })).filter((group) => group.batches.length > 0);
  const discrepancies = transfers.filter((transfer) => transfer.hasDiscrepancy && !transfer.voidedAt).length;
  return <RoleDashboard account={account} eyebrow="Manufacturer" title="Turn raw material into something more." description="Receive traceable transfers, manage production batches, and send finished goods onward." stats={[{ label: "Incoming transfers", value: String(toConfirm), detail: "Awaiting your confirmation" }, { label: "Batches in stock", value: String(inStock), detail: `${batches.filter((batch) => !batch.voidedAt).length} batches in total` }, { label: "Discrepancies", value: String(discrepancies), detail: "Received differs from sent" }]} actions={[{ label: "Confirm transfers", description: "Record quantities received from cooperatives.", href: "/dashboard/manufacturer/transfers", icon: <Truck size={20} aria-hidden="true" /> }, { label: "Create a batch", description: "Link raw material to a production run.", href: "/dashboard/manufacturer/batches/new", icon: <Factory size={20} aria-hidden="true" /> }, { label: "Send finished goods", description: "Transfer a batch's output to a distributor.", href: "/dashboard/manufacturer/transfers/new", icon: <Boxes size={20} aria-hidden="true" /> }]} >
    {/* Charts in one green on white: what came in, and what each batch made. */}
    <div className="grid gap-4">
      <ChartCard description="Kilograms of raw material received each month." table={<ReportTable headers={["Month", "Received", "Transfers"]} rows={perMonth.map((point) => [point.tip.title, kg(point.value), point.count])} />} title="Raw material received">
        <ColumnChart data={perMonth} empty="No raw material received yet." formatTick={(value) => value === 0 ? "0" : `${compactNumber(value / 1000)} kg`} peakLabel={(value) => kg(value)} />
      </ChartCard>
      {batchGroups.map(({ unit, batches: group }) => <ChartCard description={`What each batch produced${unit === "KG" ? ", in kilograms" : ", in units"}: already sent on, and still in stock.`} key={unit} legend={[{ label: "Sent", color: GREEN }, { label: "In stock", color: GREEN_LIGHT }]} table={<ReportTable headers={["Batch", "Product", "Produced", "Sent", "In stock", "Yield"]} rows={group.map((batch) => [batch.label, batch.productName, formatQuantity(toThousandths(batch.quantityProduced), batch.unit), formatQuantity(batch.sentThousandths, batch.unit), formatQuantity(batch.remainingThousandths, batch.unit), batch.yieldLabel])} />} title={batchGroups.length > 1 ? `Batches in ${unit === "KG" ? "kilograms" : "units"}` : "Batches"}>
        <StackedBarChart data={group.map((batch) => ({ label: `${batch.label} · ${batch.productName}`, total: toThousandths(batch.quantityProduced), display: formatQuantity(toThousandths(batch.quantityProduced), batch.unit), parts: [{ value: batch.sentThousandths, color: GREEN }, { value: batch.remainingThousandths, color: GREEN_LIGHT }], tip: { title: `${batch.label} · ${batch.productName}`, rows: [["Produced", formatQuantity(toThousandths(batch.quantityProduced), batch.unit)], ["Sent", formatQuantity(batch.sentThousandths, batch.unit)], ["In stock", formatQuantity(batch.remainingThousandths, batch.unit)], ["Yield", batch.yieldLabel]] } }))} />
      </ChartCard>)}
    </div>
  </RoleDashboard>;
}
