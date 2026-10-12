import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { createOrder } from "@/market/orders";

export async function POST(request: Request) {
  try {
    const { order } = await createOrder(await requireApiAccount(), await request.json());
    return Response.json({ id: order.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
