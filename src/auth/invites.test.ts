import { describe, expect, it } from "vitest";
import { validateInvite } from "@/auth/invites";
import type { Invite } from "@/domain/model";

const baseInvite: Invite = {
  id: "invite-1", code: "active-code", hubId: "hub-1", role: "COOP_LEAD", invitedById: "admin-1", maxUses: 1, uses: 0,
  expiresAt: "2027-01-01T00:00:00.000Z", createdById: "admin-1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("validateInvite", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");
  it("accepts an active invite for its hub", () => expect(() => validateInvite(baseInvite, { now, hubId: "hub-1" })).not.toThrow());
  it.each([
    ["expired", { expiresAt: "2026-01-01T00:00:00.000Z" }],
    ["revoked", { revokedAt: "2026-02-01T00:00:00.000Z" }],
    ["used up", { uses: 1 }],
  ])("rejects a %s invite", (_, changes) => expect(() => validateInvite({ ...baseInvite, ...changes }, { now })).toThrow());
  it("rejects an invite from another hub", () => expect(() => validateInvite(baseInvite, { now, hubId: "hub-2" })).toThrow());
});