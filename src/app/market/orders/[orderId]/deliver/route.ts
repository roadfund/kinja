import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { markOrderDelivered } from "@/market/orders";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    await markOrderDelivered(await requireApiAccount(), orderId, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
