import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { createTeamInvite } from "@/team/team-service";

export async function POST(request: Request) {
  try {
    const invite = await createTeamInvite(await requireApiAccount(), await request.json(), new URL(request.url).origin);
    return Response.json({ code: invite.code, role: invite.role, email: invite.email, maxUses: invite.maxUses, expiresAt: invite.expiresAt }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
