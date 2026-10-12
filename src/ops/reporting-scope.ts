import { AuthorizationError, requireRole } from "@/auth/authorization";
import type { Account } from "@/auth/server-store";
import type { Hub } from "@/domain/model";
import { getRepository } from "@/repositories/server";

// Which hub a report or export is about. Hub admins only ever get their own hub;
// tech admins may pick any hub, because they can see all data.
export async function resolveReportingHub(account: Account, requestedHubId?: string | null): Promise<Hub> {
  const scope = requireRole(account, ["HUB_ADMIN", "TECH_ADMIN"]);
  if (scope.role === "HUB_ADMIN") return account.hub!;
  const hubs = await getRepository().list("Hub");
  const hub = requestedHubId ? hubs.find((item) => item.id === requestedHubId) : hubs.find((item) => item.status === "VERIFIED") ?? hubs[0];
  if (!hub) throw new AuthorizationError("Hub not found");
  return hub;
}

// Read-only view of a hub for the tech admin, so hub-level list functions can be
// reused for reports and exports. Never use this for writes.
export async function viewAccountForHub(account: Account, hubId?: string | null): Promise<Account> {
  const scope = requireRole(account, ["HUB_ADMIN", "TECH_ADMIN"]);
  if (scope.role === "HUB_ADMIN") return account;
  const hub = await resolveReportingHub(account, hubId);
  const timestamp = new Date().toISOString();
  return { user: account.user, hub: { ...hub, status: "VERIFIED" }, membership: { id: `view-${hub.id}`, userId: account.user.id, hubId: hub.id, role: "HUB_ADMIN", status: "ACTIVE", createdById: account.user.id, createdAt: timestamp, updatedAt: timestamp } };
}

export function inPeriod(iso: string, from?: string, to?: string): boolean {
  const day = iso.slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}
