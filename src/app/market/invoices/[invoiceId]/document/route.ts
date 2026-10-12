import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { buildInvoiceDocument } from "@/market/documents";

// GET ?type=invoice|receipt: the designed PDF for an invoice the account can see.
export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await params;
    const kind = new URL(request.url).searchParams.get("type") === "receipt" ? "receipt" : "invoice";
    const document = await buildInvoiceDocument(await requireApiAccount(), invoiceId, kind);
    if (!document) return Response.json({ error: "Invoice not found" }, { status: 404 });
    return new Response(new Blob([document.bytes as BlobPart], { type: "application/pdf" }), { headers: { "Content-Disposition": `attachment; filename="${document.fileName}"` } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
