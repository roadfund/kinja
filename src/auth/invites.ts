import type { Invite, InviteStatus } from "@/domain/model";

export function validateInvite(invite: Invite, options: { now?: Date; hubId?: string } = {}): void {
  const now = options.now ?? new Date();
  if (options.hubId && invite.hubId !== options.hubId) throw new Error("Invite belongs to another hub");
  if (invite.revokedAt) throw new Error("Invite has been revoked");
  if (new Date(invite.expiresAt) <= now) throw new Error("Invite has expired");
  if (invite.uses >= invite.maxUses) throw new Error("Invite has been used up");
}
export function inviteStatus(invite: Invite, now = new Date()): InviteStatus {
  if (invite.revokedAt) return "REVOKED";
  if (invite.uses >= invite.maxUses) return "EXHAUSTED";
  if (new Date(invite.expiresAt) <= now) return "EXPIRED";
  return "ACTIVE";
}
