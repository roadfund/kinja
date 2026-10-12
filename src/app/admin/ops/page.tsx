import { BarChart3, FileText } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, EmptyState, formatDate, SectionHeader, SummaryCard, SummaryGrid } from "@/components/kinja/ui";
import { DataTable } from "@/components/kinja/data-table";
import { inputClass } from "@/components/kinja/form";
import { ExportLinks } from "@/components/ops/export-links";
import { getMoneyContext } from "@/admin/exchange-rates";
import { moneyColumns, MoneyCards } from "@/components/kinja/money";
import { moneyItem } from "@/domain/currency";
import { formatQuantity } from "@/domain/money";
import { hubCurrency } from "@/market/market-service";
import { computeImpact } from "@/ops/impact";
import { ensureMonthlyReports, listMonthlyReports, monthLabel } from "@/ops/monthly-reports";
import { resolveReportingHub } from "@/ops/reporting-scope";
import { exportDatasets } from "@/ops/exports";
import { getRepository } from "@/repositories/server";

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

export default async function OpsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; cooperativeId?: string; hubId?: string }> }) {
  const account = await requireDashboardRole(["HUB_ADMIN", "TECH_ADMIN"]);
  const filters = await searchParams;
  const isTech = account.scope.role === "TECH_ADMIN";
  const hub = await resolveReportingHub(account, filters.hubId);
  const requestHeaders = await headers();
  await ensureMonthlyReports(account, `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`);

  const repository = getRepository();
  const [impact, reports, organizations, hubs, transfers] = await Promise.all([computeImpact(hub.id, filters), listMonthlyReports(hub.id), repository.list("Organization", hub.id), isTech ? repository.list("Hub") : Promise.resolve([]), repository.list("Transfer", hub.id)]);
  const cooperatives = organizations.filter((organization) => organization.type === "COOPERATIVE");
  const currency = hubCurrency(hub);
  const money = await getMoneyContext(hub);
  // Farmer amounts are in the main currency; totals convert at today's rate.
  const amount = (minor: number) => moneyItem(minor, currency);
  const discrepancies = transfers.filter((transfer) => transfer.hasDiscrepancy && !transfer.voidedAt).length;
  const hubQuery = isTech ? `?hubId=${hub.id}` : "";

  return <DashboardShell eyebrow="Kinja Ops" title={isTech ? `Reports · ${hub.businessName}` : "Operations"} description="Impact across your value chain, monthly reports, and data exports.">
    <form className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      {isTech && <label className="text-sm font-medium text-[#344e41]">Hub<select className={inputClass} defaultValue={hub.id} name="hubId">{hubs.map((item) => <option key={item.id} value={item.id}>{item.businessName}</option>)}</select></label>}
      <label className="text-sm font-medium text-[#344e41]">From<input className={inputClass} defaultValue={filters.from} name="from" type="date" /></label>
      <label className="text-sm font-medium text-[#344e41]">To<input className={inputClass} defaultValue={filters.to} name="to" type="date" /></label>
      <label className="text-sm font-medium text-[#344e41]">Cooperative<select className={inputClass} defaultValue={filters.cooperativeId ?? ""} name="cooperativeId"><option value="">All cooperatives</option>{cooperatives.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <div className="flex gap-2"><button className="h-12 flex-1 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white" type="submit">Apply</button><Link className="inline-flex h-12 items-center rounded-xl border border-[#cbd2c9] px-4 font-semibold text-[var(--kinja-green)]" href={`/admin/ops${hubQuery}`}>Reset</Link></div>
    </form>

    <SectionHeader description="Farmers with at least one delivery in the period" title="Impact" />
    <div className="mt-5"><SummaryGrid>
      <SummaryCard detail={`of ${impact.farmersRegistered} registered`} label="Farmers reached" value={impact.farmersReached} />
      <SummaryCard detail={`${percent(impact.womenShare)} of farmers reached`} label="Women participating" value={impact.womenReached} />
      <MoneyCards detail={impact.averageDaysToPayout === null ? "Payouts start with Kinja Pay" : `${impact.averageDaysToPayout} days from delivery to payout`} label="Paid to farmers" context={money} value={amount(impact.totalPaidMinor)} />
      <SummaryCard detail={`${formatQuantity(impact.tracedRawThousandths, "KG")} of ${formatQuantity(impact.rawReceivedThousandths, "KG")} traced to farmers`} label="Local sourcing" value={percent(impact.localSourcingShare)} />
      <SummaryCard detail={formatQuantity(impact.deliveredThousandths, "KG")} label="Deliveries" value={impact.deliveries} />
      <MoneyCards detail="Before payouts" label="Amount owed" context={money} value={amount(impact.amountOwedMinor)} />
      <SummaryCard detail={isTech ? "Open moderation to review" : "See Manufacture"} label="Discrepancies" tone={discrepancies ? "warning" : undefined} value={discrepancies} />
      <SummaryCard detail="Generated on the 1st" label="Monthly reports" value={reports.length} />
    </SummaryGrid></div>

    <SectionHeader title="Deliveries by crop and grade" />
    {impact.byCropAndGrade.length === 0 ? <EmptyState description="No deliveries match these filters." icon={<BarChart3 size={22} aria-hidden="true" />} title="Nothing to show" /> :
      <DataTable rowKey={(row) => `${row.cropName}-${row.gradeName}`} rows={impact.byCropAndGrade} columns={[
        { header: "Crop", cell: (row) => <span className="font-medium text-[#344e41]">{row.cropName}</span> },
        { header: "Grade", cell: (row) => row.gradeName },
        { header: "Deliveries", align: "right", cell: (row) => row.deliveries },
        { header: "Weight", align: "right", cell: (row) => formatQuantity(row.thousandths, "KG") },
        ...moneyColumns(money, "Amount owed", (row: (typeof impact.byCropAndGrade)[number]) => amount(row.amountOwedMinor)),
      ]} />}

    <SectionHeader description="Created automatically for the previous month and emailed to the hub admin" title="Monthly reports" />
    {reports.length === 0 ? <EmptyState description="The first report appears after your hub's first full month." icon={<FileText size={22} aria-hidden="true" />} title="No reports yet" /> :
      <DataTable rowKey={(report) => report.id} rows={reports} columns={[
        { header: "Month", cell: (report) => <Link className="font-semibold text-[var(--kinja-green)] hover:underline" href={`/admin/ops/reports/${report.month}${hubQuery}`}>{monthLabel(report.month)}</Link> },
        { header: "Generated", cell: (report) => formatDate(report.createdAt) },
        ...moneyColumns(money, "Sales", (report: (typeof reports)[number]) => moneyItem(report.data.financial.salesMinor, report.data.currency, `${report.month}-28T12:00:00.000Z`)),
        { header: "Active farmers", align: "right", cell: (report) => report.data.farmers.activeFarmers },
        ...(["pdf", "csv"] as const).map((format) => ({ header: format.toUpperCase(), cell: (report: (typeof reports)[number]) => <a className="font-semibold text-[var(--kinja-green)] underline" download href={`/ops/reports/${report.month}?format=${format}${isTech ? `&hubId=${hub.id}` : ""}`}>Download</a> })),
      ]} />}

    <SectionHeader description="Everything in the hub, as CSV or PDF" title="Exports" />
    <div className="mt-5"><ExportLinks datasets={[...exportDatasets]} hubId={isTech ? hub.id : undefined} /></div>
  </DashboardShell>;
}
