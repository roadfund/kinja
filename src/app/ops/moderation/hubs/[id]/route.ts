import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { setHubSuspended } from "@/ops/moderation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await setHubSuspended(await requireApiAccount(), (await params).id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
