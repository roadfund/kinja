import { requireCooperativeScope } from "@/auth/authorization";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { dismissDuplicateFlag } from "@/field/farmers";

// Only the coop lead decides a flagged farmer is a different person.
export async function POST(_request: Request, { params }: { params: Promise<{ farmerId: string }> }) {
  try {
    const scope = requireCooperativeScope(await requireApiAccount(), ["COOP_LEAD"]);
    await dismissDuplicateFlag((await params).farmerId, { hubId: scope.hubId, cooperativeId: scope.organizationId, userId: scope.userId });
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
