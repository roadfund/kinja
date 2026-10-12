import { buildPdf, toCsv, type PdfSection } from "@/ops/pdf";
import { toXlsx } from "@/ops/xlsx";

export function fileName(title: string, extension: "csv" | "pdf" | "xlsx"): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.${extension}`;
}

export function csvResponse(title: string, headers: string[], rows: string[][]): Response {
  return new Response(toCsv(headers, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName(title, "csv")}"` } });
}

export function pdfResponse(title: string, subtitle: string, sections: PdfSection[]): Response {
  return new Response(new Blob([buildPdf(title, subtitle, sections) as BlobPart], { type: "application/pdf" }), { headers: { "Content-Disposition": `attachment; filename="${fileName(title, "pdf")}"` } });
}

export function xlsxResponse(title: string, headers: string[], rows: string[][]): Response {
  return new Response(new Blob([toXlsx(title, headers, rows) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), { headers: { "Content-Disposition": `attachment; filename="${fileName(title, "xlsx")}"` } });
}
