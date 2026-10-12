import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { csvResponse, pdfResponse, xlsxResponse } from "@/ops/download";
import { buildExport, exportDatasets, exportSubtitle, type ExportDataset } from "@/ops/exports";

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  try {
    const { dataset } = await params;
    if (!exportDatasets.includes(dataset as ExportDataset)) return Response.json({ error: "Unknown export" }, { status: 404 });
    const url = new URL(request.url);
    const account = await requireApiAccount();
    const table = await buildExport(account, dataset as ExportDataset, url.searchParams.get("hubId"));
    const format = url.searchParams.get("format");
    if (format === "pdf") return pdfResponse(table.title, exportSubtitle(account), [{ table: { headers: table.headers, rows: table.rows } }]);
    if (format === "xlsx") return xlsxResponse(table.title, table.headers, table.rows);
    return csvResponse(table.title, table.headers, table.rows);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
