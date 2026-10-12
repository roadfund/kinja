import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { revokeInvite } from "@/team/team-service";

export async function POST(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  try {
    await revokeInvite(await requireApiAccount(), (await params).inviteId);
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
