import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { voidableEntities, voidRecord, type VoidableEntity } from "@/ops/moderation";

export async function POST(request: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { entity, id } = await params;
    if (!voidableEntities.includes(entity as VoidableEntity)) return Response.json({ error: "Unknown record type" }, { status: 404 });
    await voidRecord(await requireApiAccount(), entity as VoidableEntity, id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
