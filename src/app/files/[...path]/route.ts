import { getCurrentAccount } from "@/auth/route-authorization";
import { STORED_FILE } from "@/domain/files";
import { getObjectStore } from "@/storage/object-store";

const LINK_SECONDS = 60 * 60;

// Serves an uploaded file to someone signed in, by redirecting to a bucket link that expires.
// Photos and logos: any active member. Registration certificates: the tech admin, or the
// admin of the hub the certificate belongs to.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const key = (await params).path.join("/");
  const path = `/files/${key}`;
  if (!STORED_FILE.test(path)) return new Response("Not found", { status: 404 });
  const account = await getCurrentAccount();
  if (!account?.membership || account.membership.status !== "ACTIVE") return new Response("Sign in to view this file", { status: 401 });
  if (key.startsWith("certificates/") && account.membership.role !== "TECH_ADMIN" && !(account.membership.role === "HUB_ADMIN" && account.hub?.registrationCertificateUrl === path)) return new Response("Not found", { status: 404 });
  const store = getObjectStore();
  if (!store) return new Response("File storage is not configured", { status: 404 });
  return new Response(null, { status: 302, headers: { Location: await store.signedUrl(key, LINK_SECONDS), "Cache-Control": "private, max-age=3000" } });
}
