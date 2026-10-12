import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getMoneyContext } from "@/admin/exchange-rates";
import { requireDashboardRole } from "@/auth/route-authorization";
import { DashboardShell, formatDate } from "@/components/kinja/ui";
import { listMonthlyReports, monthLabel } from "@/ops/monthly-reports";
import { reportSections } from "@/ops/report-document";
import { resolveReportingHub } from "@/ops/reporting-scope";

export default async function MonthlyReportPage({ params, searchParams }: { params: Promise<{ month: string }>; searchParams: Promise<{ hubId?: string }> }) {
  const account = await requireDashboardRole(["HUB_ADMIN", "TECH_ADMIN"]);
  const [{ month }, { hubId }] = await Promise.all([params, searchParams]);
  const hub = await resolveReportingHub(account, hubId);
  const report = (await listMonthlyReports(hub.id)).find((item) => item.month === month);
  if (!report) notFound();
  const money = await getMoneyContext(hub);
  const query = account.scope.role === "TECH_ADMIN" ? `&hubId=${hub.id}` : "";
  const download = (format: "pdf" | "csv") => <a className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#cbd2c9] bg-white px-4 font-semibold text-[var(--kinja-green)]" download href={`/ops/reports/${month}?format=${format}${query}`}><Download size={16} aria-hidden="true" />{format.toUpperCase()}</a>;
  return <DashboardShell actions={<>{download("pdf")}{download("csv")}</>} back={{ href: `/admin/ops${account.scope.role === "TECH_ADMIN" ? `?hubId=${hub.id}` : ""}`, label: "Kinja Ops" }} description={`${hub.businessName} · generated ${formatDate(report.createdAt)}`} eyebrow="Monthly report" title={monthLabel(month)}>
    <div className="grid gap-4 xl:grid-cols-2">{reportSections(report, money).map((section) => <section className="rounded-2xl bg-white p-6" key={section.title}><h2 className="font-semibold text-[var(--kinja-green)]">{section.title}</h2><dl className="mt-4 divide-y divide-[#eef1eb]">{section.rows.map(([label, value]) => <div className="flex justify-between gap-4 py-2.5 text-sm" key={label}><dt className="text-[#5d685e]">{label}</dt><dd className="font-semibold text-[#344e41]">{value}</dd></div>)}</dl></section>)}</div>
  </DashboardShell>;
}
