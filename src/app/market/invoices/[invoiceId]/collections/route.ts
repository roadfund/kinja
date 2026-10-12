import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { recordCollection } from "@/market/market-service";

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  try {
    const collection = await recordCollection(await requireApiAccount(), (await params).invoiceId, await request.json());
    return Response.json({ id: collection.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
