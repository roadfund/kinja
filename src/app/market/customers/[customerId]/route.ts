import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { saveCustomer } from "@/market/market-service";

export async function PUT(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const customer = await saveCustomer(await requireApiAccount(), (await params).customerId, await request.json());
    return Response.json({ id: customer.id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
