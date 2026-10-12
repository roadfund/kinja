import { getMoneyContext } from "@/admin/exchange-rates";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { csvResponse, pdfResponse } from "@/ops/download";
import { listMonthlyReports, monthLabel } from "@/ops/monthly-reports";
import { reportPdfSections, reportSections } from "@/ops/report-document";
import { resolveReportingHub } from "@/ops/reporting-scope";

export async function GET(request: Request, { params }: { params: Promise<{ month: string }> }) {
  try {
    const url = new URL(request.url);
    const hub = await resolveReportingHub(await requireApiAccount(), url.searchParams.get("hubId"));
    const { month } = await params;
    const report = (await listMonthlyReports(hub.id)).find((item) => item.month === month);
    if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
    const money = await getMoneyContext(hub);
    const title = `${hub.businessName} monthly report ${month}`;
    if (url.searchParams.get("format") === "pdf") return pdfResponse(`${hub.businessName} - ${monthLabel(month)}`, `Monthly report generated ${report.createdAt.slice(0, 10)}`, reportPdfSections(report, money));
    return csvResponse(title, ["Section", "Measure", "Value"], reportSections(report, money).flatMap((section) => section.rows.map(([label, value]) => [section.title, label, value])));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
