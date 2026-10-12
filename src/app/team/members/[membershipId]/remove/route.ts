import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { removeMember } from "@/team/team-service";

export async function POST(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  try {
    await removeMember(await requireApiAccount(), (await params).membershipId);
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
