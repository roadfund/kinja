import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { receiveTransfer } from "@/manufacture/manufacture-service";

export async function POST(request: Request, { params }: { params: Promise<{ transferId: string }> }) {
  try {
    const transfer = await receiveTransfer(await requireApiAccount(), (await params).transferId, await request.json());
    return Response.json({ id: transfer.id, hasDiscrepancy: transfer.hasDiscrepancy });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
