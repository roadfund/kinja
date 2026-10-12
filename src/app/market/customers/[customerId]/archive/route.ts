import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { setCustomerArchived } from "@/market/market-service";

export async function POST(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    const { archived } = (await request.json()) as { archived?: boolean };
    await setCustomerArchived(await requireApiAccount(), (await params).customerId, archived !== false);
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
