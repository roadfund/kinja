import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { saveCustomer } from "@/market/market-service";

export async function POST(request: Request) {
  try {
    const customer = await saveCustomer(await requireApiAccount(), null, await request.json());
    return Response.json({ id: customer.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
