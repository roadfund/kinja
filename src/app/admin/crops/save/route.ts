import { saveCropSetups } from "@/admin/hub-crop-setup";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

// Saves every changed crop on the crops page in one request.
export async function POST(request: Request) {
  try {
    return Response.json({ results: await saveCropSetups(await requireApiAccount(), await request.json()) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
