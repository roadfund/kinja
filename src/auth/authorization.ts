import type { Hub, Membership, Organization, OrganizationType, Role } from "@/domain/model";

export type Scope = { userId: string; hubId: string; organizationId?: string; role: Role };
export type CooperativeScope = Scope & { organizationId: string };
export type OrganizationScope = Scope & { organizationId: string };
type Subject = { user: { id: string }; membership?: Membership; hub?: Hub; organization?: Organization };

export class AuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403 = 403) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function canOperateWhilePending(role: Role): boolean {
  return role === "HUB_ADMIN" || role === "TECH_ADMIN";
}

// The single server-side check behind every page and API route. It enforces:
// an active membership, an allowed role, hub isolation (the hub must be the
// membership's hub), no access to suspended or rejected hubs, and that only hub
// admins can work in a hub that is still pending verification.
export function requireRole(subject: Subject, allowedRoles: Role[], options: { verifiedHub?: boolean } = {}): Scope {
  const { membership, hub } = subject;
  if (!membership) throw new AuthorizationError("Sign in to continue", 401);
  if (membership.status !== "ACTIVE") throw new AuthorizationError("Your membership is not active");
  if (!allowedRoles.includes(membership.role)) throw new AuthorizationError("You do not have permission to do this");

  const scope: Scope = { userId: subject.user.id, hubId: membership.hubId, organizationId: membership.organizationId, role: membership.role };
  if (membership.role === "TECH_ADMIN") return scope;

  if (!hub || hub.id !== membership.hubId) throw new AuthorizationError("Hub access denied");
  if (hub.status === "SUSPENDED" || hub.status === "REJECTED") throw new AuthorizationError("This hub is not available");
  if (hub.status === "PENDING_VERIFICATION" && (options.verifiedHub || !canOperateWhilePending(membership.role))) throw new AuthorizationError("This hub must be verified first");
  if (subject.organization?.suspendedAt) throw new AuthorizationError("Your organization is suspended");
  return scope;
}

// For members of one organization: the organization must be theirs, of the
// expected type, in the same hub, and not suspended.
export function requireOrganizationScope(subject: Subject, allowedRoles: Role[], type: OrganizationType): OrganizationScope {
  const scope = requireRole(subject, allowedRoles);
  const { organization } = subject;
  if (!scope.organizationId || organization?.id !== scope.organizationId || organization.type !== type || organization.hubId !== scope.hubId) throw new AuthorizationError(`You are not a member of a ${type.toLowerCase()}`);
  return { ...scope, organizationId: scope.organizationId };
}

export function requireCooperativeScope(subject: Subject, roles: Role[] = ["COOP_LEAD", "FIELD_STAFF"]): CooperativeScope {
  return requireOrganizationScope(subject, roles, "COOPERATIVE");
}
