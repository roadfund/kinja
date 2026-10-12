import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { cancelOrder } from "@/market/orders";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    await cancelOrder(await requireApiAccount(), orderId, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
