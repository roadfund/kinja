import { setMasterCropArchived } from "@/admin/master-crops";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request, { params }: { params: Promise<{ cropId: string }> }) {
  try {
    const { archived } = (await request.json()) as { archived?: boolean };
    await setMasterCropArchived(await requireApiAccount(), (await params).cropId, Boolean(archived));
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
