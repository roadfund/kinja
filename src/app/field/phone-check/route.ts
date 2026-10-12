import { requireCooperativeScope } from "@/auth/authorization";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { findFarmersWithPhone } from "@/field/farmers";

export async function GET(request: Request) {
  try {
    const scope = requireCooperativeScope(await requireApiAccount());
    const url = new URL(request.url);
    const phone = url.searchParams.get("phone") ?? "";
    return Response.json({ matches: phone ? await findFarmersWithPhone(scope.hubId, scope.organizationId, phone, url.searchParams.get("exclude") ?? undefined) : [] });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
