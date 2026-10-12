import { setCountryCurrencies } from "@/admin/exchange-rates";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    const setting = await setCountryCurrencies(await requireApiAccount(), await request.json());
    return Response.json({ currencies: setting.extraCurrencies });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
