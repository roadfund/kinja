import { updateProfile } from "@/account/account-service";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    await updateProfile(await requireApiAccount(), await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
