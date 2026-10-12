import { saveCropSetup } from "@/admin/hub-crop-setup";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    const hubCrop = await saveCropSetup(await requireApiAccount(), await request.json());
    return Response.json({ id: hubCrop.id, grades: hubCrop.grades });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
