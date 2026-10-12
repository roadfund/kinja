import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { buildOfflinePack } from "@/field/sync-service";

export async function GET() {
  try {
    return Response.json(await buildOfflinePack(await requireApiAccount()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
