import { addMasterCrop } from "@/admin/master-crops";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    const crop = await addMasterCrop(await requireApiAccount(), await request.json());
    return Response.json({ id: crop.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
