import { reviewHubById } from "@/admin/hub-review-service";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    const hub = await reviewHubById(await requireApiAccount(), await request.json());
    return Response.json({ id: hub.id, status: hub.status });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
