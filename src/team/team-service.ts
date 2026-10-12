import { z } from "zod";
import { acceptInvite as consumeInvite } from "@/admin/invite-acceptance";
import { createInvite } from "@/admin/team-invites";
import { AuthorizationError, requireRole, type Scope } from "@/auth/authorization";
import { inviteStatus, validateInvite } from "@/auth/invites";
import { deleteSessionsForUser, type Account } from "@/auth/server-store";
import { createUuidV7 } from "@/domain/id";
import type { Invite, InviteStatus, Membership, Organization, OrganizationType, Role } from "@/domain/model";
import { roleLabels } from "@/domain/person";
import { sendEmail } from "@/email/outbox";
import { getRepository } from "@/repositories/server";

const INVITE_DAYS = 7;
const MULTI_USE_LIMIT = 25;
const TEAM_MANAGERS: Role[] = ["HUB_ADMIN", "COOP_LEAD"];

export const organizationTypeForRole: Partial<Record<Role, OrganizationType>> = { COOP_LEAD: "COOPERATIVE", FIELD_STAFF: "COOPERATIVE", MANUFACTURER: "MANUFACTURER", DISTRIBUTOR: "DISTRIBUTOR" };

// Which roles each manager may invite, and later remove.
export function invitableRoles(role: Role): Role[] {
  if (role === "HUB_ADMIN") return ["COOP_LEAD", "MANUFACTURER", "DISTRIBUTOR"];
  if (role === "COOP_LEAD") return ["FIELD_STAFF"];
  return [];
}

export type TeamMember = { membershipId: string; userId: string; fullName: string; username: string; email?: string; phone?: string; photoUrl?: string; role: Role; organizationName?: string; joinedAt: string; isSelf: boolean; canRemove: boolean };
export type TeamInvite = { id: string; code: string; role: Role; organizationName?: string; isNewOrganization: boolean; email?: string; invitedByName: string; uses: number; maxUses: number; createdAt: string; expiresAt: string; status: InviteStatus };
export type TeamView = { scope: Scope; hubName: string; hubVerified: boolean; members: TeamMember[]; invites: TeamInvite[]; organizations: Array<Pick<Organization, "id" | "name" | "type">> };

function inTeam(scope: Scope, record: { organizationId?: string }): boolean {
  return scope.role === "HUB_ADMIN" || (scope.organizationId !== undefined && record.organizationId === scope.organizationId);
}

// Hub admins see everyone in their hub; cooperative leads see their own cooperative.
export async function getTeam(account: Account, now = new Date()): Promise<TeamView> {
  const scope = requireRole(account, TEAM_MANAGERS);
  const repository = getRepository();
  const [memberships, invites, organizations, users] = await Promise.all([repository.list("Membership", scope.hubId), repository.list("Invite", scope.hubId), repository.list("Organization", scope.hubId), repository.list("User")]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const orgName = (id?: string) => organizations.find((organization) => organization.id === id)?.name;
  const removable = invitableRoles(scope.role);

  const members = memberships
    .filter((membership) => membership.status === "ACTIVE" && inTeam(scope, membership))
    .flatMap((membership): TeamMember[] => {
      const user = usersById.get(membership.userId);
      if (!user) return [];
      const isSelf = user.id === scope.userId;
      return [{ membershipId: membership.id, userId: user.id, fullName: user.fullName, username: user.username, email: user.email, phone: user.phone, photoUrl: user.photoUrl, role: membership.role, organizationName: orgName(membership.organizationId), joinedAt: membership.createdAt, isSelf, canRemove: !isSelf && removable.includes(membership.role) }];
    })
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

  const teamInvites = invites
    .filter((invite) => inTeam(scope, invite))
    .map((invite): TeamInvite => ({ id: invite.id, code: invite.code, role: invite.role, organizationName: orgName(invite.organizationId) ?? invite.organizationName, isNewOrganization: !invite.organizationId && Boolean(invite.organizationName), email: invite.email, invitedByName: usersById.get(invite.invitedById)?.fullName ?? "Unknown", uses: invite.uses, maxUses: invite.maxUses, createdAt: invite.createdAt, expiresAt: invite.expiresAt, status: inviteStatus(invite, now) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { scope, hubName: account.hub!.businessName, hubVerified: account.hub!.status === "VERIFIED", members, invites: teamInvites, organizations: organizations.filter((organization) => inTeam(scope, { organizationId: organization.id })).map(({ id, name, type }) => ({ id, name, type })) };
}

export const TeamInviteInput = z.object({
  role: z.enum(["COOP_LEAD", "FIELD_STAFF", "MANUFACTURER", "DISTRIBUTOR"]),
  organizationId: z.string().trim().min(1).optional(),
  organizationName: z.string().trim().min(2).max(80).optional(),
  email: z.union([z.literal(""), z.string().trim().email()]).optional().transform((email) => email || undefined),
  multiUse: z.boolean().default(false),
});

// Invites are only created here, by hub admins and cooperative leads of a
// verified hub. The organization is checked against the caller's hub.
export async function createTeamInvite(account: Account, input: unknown, origin: string, now = new Date()): Promise<Invite> {
  const scope = requireRole(account, TEAM_MANAGERS, { verifiedHub: true });
  const details = TeamInviteInput.parse(input);
  if (!invitableRoles(scope.role).includes(details.role)) throw new AuthorizationError(scope.role === "COOP_LEAD" ? "Cooperative leads can only invite field staff" : "Hub admins invite cooperative leads, manufacturers and distributors");

  let organizationId: string | undefined;
  let organizationName: string | undefined;
  if (scope.role === "COOP_LEAD") {
    organizationId = scope.organizationId;
  } else if (details.organizationId) {
    const organization = await getRepository().get("Organization", details.organizationId, scope.hubId);
    if (!organization || organization.type !== organizationTypeForRole[details.role]) throw new Error("Choose an organization of the right type in your hub");
    organizationId = organization.id;
  } else if (details.organizationName) {
    organizationName = details.organizationName;
  } else {
    throw new Error("Choose an organization or name a new one");
  }

  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const invite = createInvite(account.hub!, { actorId: scope.userId, actorRole: scope.role, role: details.role, organizationId, organizationName, email: details.email, maxUses: details.multiUse ? MULTI_USE_LIMIT : 1, expiresAt, now });
  await getRepository().put("Invite", invite);

  if (invite.email) {
    const link = `${origin}/auth/invite/${invite.code}`;
    await sendEmail({ to: invite.email, subject: `You're invited to join ${account.hub!.businessName} on Kinja`, text: `${account.user.fullName} invited you to join ${account.hub!.businessName} as a ${roleLabels[invite.role].toLowerCase()}.\n\nAccept the invitation here (it expires in ${INVITE_DAYS} days):\n\n${link}\n\nOr enter this code when you sign up: ${invite.code}`, link }, now);
  }
  return invite;
}

export async function revokeInvite(account: Account, inviteId: string, now = new Date()): Promise<Invite> {
  const scope = requireRole(account, TEAM_MANAGERS);
  const invite = await getRepository().get("Invite", inviteId, scope.hubId);
  if (!invite || !inTeam(scope, invite)) throw new Error("Invite not found");
  if (inviteStatus(invite, now) !== "ACTIVE") throw new Error("Only active invites can be revoked");
  const revoked: Invite = { ...invite, revokedAt: now.toISOString(), revokedById: scope.userId, updatedAt: now.toISOString() };
  await getRepository().put("Invite", revoked);
  return revoked;
}

// Removing a member ends their access straight away, including open sessions.
export async function removeMember(account: Account, membershipId: string, now = new Date()): Promise<Membership> {
  const scope = requireRole(account, TEAM_MANAGERS);
  const membership = await getRepository().get("Membership", membershipId, scope.hubId);
  if (!membership || membership.status !== "ACTIVE" || !inTeam(scope, membership)) throw new Error("Member not found");
  if (membership.userId === scope.userId) throw new Error("You cannot remove yourself");
  if (!invitableRoles(scope.role).includes(membership.role)) throw new AuthorizationError("You cannot remove this member");
  const removed: Membership = { ...membership, status: "REMOVED", removedAt: now.toISOString(), removedById: scope.userId, updatedAt: now.toISOString() };
  await getRepository().put("Membership", removed);
  await deleteSessionsForUser(membership.userId);
  return removed;
}

export type InvitePreview = { code: string; status: InviteStatus; hubName: string; role: Role; organizationName?: string; invitedByName: string; expiresAt: string };

async function findInviteByCode(code: string): Promise<Invite | null> {
  const wanted = code.trim().toUpperCase();
  return (await getRepository().list("Invite")).find((invite) => invite.code.toUpperCase() === wanted) ?? null;
}

// What the invite landing page shows. Returns null for unknown codes.
export async function getInvitePreview(code: string, now = new Date()): Promise<InvitePreview | null> {
  const invite = await findInviteByCode(code);
  if (!invite) return null;
  const repository = getRepository();
  const [hub, inviter, organization] = await Promise.all([repository.get("Hub", invite.hubId), repository.get("User", invite.invitedById), invite.organizationId ? repository.get("Organization", invite.organizationId, invite.hubId) : null]);
  if (!hub) return null;
  const status = hub.status === "VERIFIED" ? inviteStatus(invite, now) : "REVOKED";
  return { code: invite.code, status, hubName: hub.businessName, role: invite.role, organizationName: organization?.name ?? invite.organizationName, invitedByName: inviter?.fullName ?? "Your hub", expiresAt: invite.expiresAt };
}

// Grants the invite's role and organization to the user. Everything comes
// from the invite record, never from the client.
export async function acceptInviteForUser(code: string, userId: string, now = new Date()): Promise<Membership> {
  const repository = getRepository();
  const invite = await findInviteByCode(code);
  if (!invite) throw new Error("This invite code is not valid");
  validateInvite(invite, { now });

  const hub = await repository.get("Hub", invite.hubId);
  if (!hub || hub.status !== "VERIFIED") throw new Error("This invite is no longer available");
  const memberships = await repository.list("Membership");
  if (memberships.some((membership) => membership.userId === userId && membership.status !== "REMOVED")) throw new Error("You already belong to a hub. Each account can have one role.");

  const timestamp = now.toISOString();
  let organizationId = invite.organizationId;
  if (organizationId) {
    const organization = await repository.get("Organization", organizationId, invite.hubId);
    if (!organization || organization.type !== organizationTypeForRole[invite.role]) throw new Error("This invite is no longer available");
  } else if (invite.organizationName) {
    const type = organizationTypeForRole[invite.role];
    if (!type) throw new Error("This invite is no longer available");
    organizationId = createUuidV7();
    await repository.put("Organization", { id: organizationId, hubId: invite.hubId, name: invite.organizationName, type, createdById: userId, createdAt: timestamp, updatedAt: timestamp });
  }

  // Multi-use invites for a new organization add everyone to the same one.
  const { invite: used, membership } = consumeInvite({ ...invite, organizationId, organizationName: organizationId ? undefined : invite.organizationName }, { userId, now });
  await repository.put("Invite", used);
  await repository.put("Membership", membership);
  return membership;
}
