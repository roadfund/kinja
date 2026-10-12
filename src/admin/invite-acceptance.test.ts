import { describe, expect, it } from "vitest";
import { acceptInvite } from "@/admin/invite-acceptance";
import type { Invite } from "@/domain/model";

const invite: Invite = { id: "invite-1", code: "ACTIVE-CODE", hubId: "hub-1", organizationId: "coop-1", role: "COOP_LEAD", invitedById: "admin-1", maxUses: 1, uses: 0, expiresAt: "2026-06-08T00:00:00.000Z", createdById: "admin-1", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: "2026-06-01T00:00:00.000Z" };

describe("acceptInvite", () => {
  it("creates active membership from the invite scope and consumes one use", () => {
    const result = acceptInvite(invite, { userId: "user-2", now: new Date("2026-06-02T00:00:00.000Z") });
    expect(result.invite.uses).toBe(1);
    expect(result.membership).toMatchObject({ userId: "user-2", hubId: "hub-1", organizationId: "coop-1", role: "COOP_LEAD", status: "ACTIVE" });
  });

  it("rejects an invite after its available use is consumed", () => {
    expect(() => acceptInvite({ ...invite, uses: 1 }, { userId: "user-3", now: new Date("2026-06-02T00:00:00.000Z") })).toThrow("used up");
  });
});