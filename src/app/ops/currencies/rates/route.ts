import { setExchangeRate } from "@/admin/exchange-rates";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    const rate = await setExchangeRate(await requireApiAccount(), await request.json());
    return Response.json({ id: rate.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
