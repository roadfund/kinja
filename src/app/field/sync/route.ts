import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";
import { applySyncBatch } from "@/field/sync-service";

// Every Kinja Field write (farmers, plots, deliveries) arrives here from a device's sync queue.
export async function POST(request: Request) {
  try {
    return Response.json({ results: await applySyncBatch(await requireApiAccount(), await request.json()) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
