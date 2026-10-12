import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { createRawMaterialTransfer } from "@/manufacture/manufacture-service";

export async function POST(request: Request) {
  try {
    const record = await createRawMaterialTransfer(await requireApiAccount(), await request.json());
    return Response.json({ id: record.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
