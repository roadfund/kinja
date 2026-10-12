import { beforeEach, describe, expect, it } from "vitest";
import { authenticate, createSession, createUserWithMembership, getAccountFromSession, loadAccount, type Account } from "@/auth/server-store";
import { loadSeedData, seedIds } from "@/dev/seed";
import { listOutbox } from "@/email/outbox";
import { getRepository } from "@/repositories/server";
import { acceptInviteForUser, createTeamInvite, getInvitePreview, getTeam, removeMember, revokeInvite } from "@/team/team-service";
import { useMemoryRepository } from "@/test/memory-repository";

const ORIGIN = "http://localhost:3000";

async function accountFor(username: string): Promise<Account> {
  const user = (await getRepository().list("User")).find((item) => item.username === username)!;
  return (await loadAccount(user.id))!;
}

async function newUser(username: string) {
  const passwordHash = "salt.hash";
  const now = new Date().toISOString();
  const user = { id: `user-${username}`, fullName: `New ${username}`, username, phone: "+231770009999", passwordHash, passwordSalt: "salt", createdById: "self", createdAt: now, updatedAt: now };
  await getRepository().put("User", user);
  return user;
}

describe("team", () => {
  let hubAdmin: Account;
  let coopLead: Account;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData();
    hubAdmin = await accountFor("hubadmin");
    coopLead = await accountFor("cooplead");
  });

  it("shows hub admins the whole hub and cooperative leads only their cooperative", async () => {
    const hubTeam = await getTeam(hubAdmin);
    expect(hubTeam.members.map((member) => member.role).sort()).toEqual(["COOP_LEAD", "DISTRIBUTOR", "FIELD_STAFF", "HUB_ADMIN", "MANUFACTURER"]);
    expect(hubTeam.members.find((member) => member.isSelf)?.canRemove).toBe(false);
    expect(new Set(hubTeam.invites.map((invite) => invite.status))).toEqual(new Set(["ACTIVE", "EXPIRED", "REVOKED"]));

    const coopTeam = await getTeam(coopLead);
    expect(coopTeam.members.map((member) => member.role).sort()).toEqual(["COOP_LEAD", "FIELD_STAFF"]);
    expect(coopTeam.invites.every((invite) => invite.role === "FIELD_STAFF")).toBe(true);
    await expect(getTeam(await accountFor("fieldstaff"))).rejects.toThrow("permission");
  });

  it("creates invites for an existing or a new organization, and emails them", async () => {
    const existing = await createTeamInvite(hubAdmin, { role: "MANUFACTURER", organizationId: seedIds.manufacturer, email: "plant@example.com" }, ORIGIN);
    expect(existing.organizationId).toBe(seedIds.manufacturer);
    expect((await listOutbox())[0]).toMatchObject({ to: "plant@example.com", link: `${ORIGIN}/auth/invite/${existing.code}` });

    const fresh = await createTeamInvite(hubAdmin, { role: "COOP_LEAD", organizationName: "Totota Growers" }, ORIGIN);
    expect(fresh).toMatchObject({ organizationId: undefined, organizationName: "Totota Growers" });
  });

  it("rejects invites to the wrong organization type, other hubs, or roles the caller cannot invite", async () => {
    await expect(createTeamInvite(hubAdmin, { role: "DISTRIBUTOR", organizationId: seedIds.cooperative }, ORIGIN)).rejects.toThrow("right type");
    await expect(createTeamInvite(hubAdmin, { role: "COOP_LEAD", organizationId: "other-hub-org" }, ORIGIN)).rejects.toThrow("right type");
    await expect(createTeamInvite(hubAdmin, { role: "COOP_LEAD" }, ORIGIN)).rejects.toThrow("Choose an organization");
    await expect(createTeamInvite(hubAdmin, { role: "FIELD_STAFF", organizationId: seedIds.cooperative }, ORIGIN)).rejects.toThrow("Hub admins invite");
    await expect(createTeamInvite(coopLead, { role: "MANUFACTURER" }, ORIGIN)).rejects.toThrow("only invite field staff");
    const staffInvite = await createTeamInvite(coopLead, { role: "FIELD_STAFF", organizationId: seedIds.manufacturer }, ORIGIN);
    expect(staffInvite.organizationId).toBe(seedIds.cooperative);
  });

  it("revokes active invites within the caller's team only", async () => {
    const invite = await createTeamInvite(hubAdmin, { role: "DISTRIBUTOR", organizationId: seedIds.distributor }, ORIGIN);
    await expect(revokeInvite(coopLead, invite.id)).rejects.toThrow("not found");
    expect((await revokeInvite(hubAdmin, invite.id)).revokedById).toBe(hubAdmin.user.id);
    await expect(revokeInvite(hubAdmin, invite.id)).rejects.toThrow("Only active");
  });

  it("removes members and signs them out, but never the caller or members outside their reach", async () => {
    const team = await getTeam(hubAdmin);
    const lead = team.members.find((member) => member.role === "COOP_LEAD")!;
    const staff = team.members.find((member) => member.role === "FIELD_STAFF")!;
    const self = team.members.find((member) => member.isSelf)!;
    const session = await createSession(lead.userId);

    await expect(removeMember(hubAdmin, self.membershipId)).rejects.toThrow("yourself");
    await expect(removeMember(hubAdmin, staff.membershipId)).rejects.toThrow("cannot remove");
    await removeMember(hubAdmin, lead.membershipId);
    expect(await getAccountFromSession(session)).toBeNull();
    expect((await loadAccount(lead.userId))!.membership).toBeUndefined();
  });

  it("lets a cooperative lead remove their field staff", async () => {
    const staff = (await getTeam(coopLead)).members.find((member) => member.role === "FIELD_STAFF")!;
    expect((await removeMember(coopLead, staff.membershipId)).status).toBe("REMOVED");
  });
});

describe("invite acceptance", () => {
  let hubAdmin: Account;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData();
    hubAdmin = await accountFor("hubadmin");
  });

  it("joins with the invite's role and organization and consumes one use", async () => {
    const invite = await createTeamInvite(hubAdmin, { role: "MANUFACTURER", organizationId: seedIds.manufacturer }, ORIGIN);
    expect(await getInvitePreview(invite.code.toLowerCase())).toMatchObject({ status: "ACTIVE", hubName: "Jimmy's Group", role: "MANUFACTURER", organizationName: "Bong Cassava Processors", invitedByName: "Jimmy Kpadeh" });
    const user = await newUser("newmaker");
    const membership = await acceptInviteForUser(invite.code, user.id);
    expect(membership).toMatchObject({ userId: user.id, hubId: seedIds.verifiedHub, organizationId: seedIds.manufacturer, role: "MANUFACTURER", status: "ACTIVE" });
    expect((await getInvitePreview(invite.code))!.status).toBe("EXHAUSTED");
    await expect(acceptInviteForUser(invite.code, (await newUser("second")).id)).rejects.toThrow("used up");
  });

  it("creates a new organization once and reuses it for a multi-use invite", async () => {
    const invite = await createTeamInvite(hubAdmin, { role: "COOP_LEAD", organizationName: "Totota Growers", multiUse: true }, ORIGIN);
    const first = await acceptInviteForUser(invite.code, (await newUser("first")).id);
    const second = await acceptInviteForUser(invite.code, (await newUser("second")).id);
    expect(first.organizationId).toBeTruthy();
    expect(second.organizationId).toBe(first.organizationId);
    expect((await getRepository().list("Organization")).filter((organization) => organization.name === "Totota Growers")).toHaveLength(1);
  });

  it("rejects expired, revoked, unknown and already-member cases", async () => {
    const invites = await getRepository().list("Invite");
    const expired = invites.find((invite) => new Date(invite.expiresAt) < new Date())!;
    const revoked = invites.find((invite) => invite.revokedAt)!;
    const user = await newUser("visitor");
    await expect(acceptInviteForUser(expired.code, user.id)).rejects.toThrow("expired");
    await expect(acceptInviteForUser(revoked.code, user.id)).rejects.toThrow("revoked");
    await expect(acceptInviteForUser("NOT-A-CODE", user.id)).rejects.toThrow("not valid");

    const invite = await createTeamInvite(hubAdmin, { role: "DISTRIBUTOR", organizationId: seedIds.distributor }, ORIGIN);
    const existingMember = (await authenticate("manufacturer", "kinja-dev-password"))!.account.user;
    await expect(acceptInviteForUser(invite.code, existingMember.id)).rejects.toThrow("already belong");
  });

  it("rejects invites whose organization belongs to another hub", async () => {
    const invite = await createTeamInvite(hubAdmin, { role: "DISTRIBUTOR", organizationId: seedIds.distributor }, ORIGIN);
    const organization = (await getRepository().get("Organization", seedIds.distributor))!;
    await getRepository().put("Organization", { ...organization, hubId: seedIds.pendingHub });
    await expect(acceptInviteForUser(invite.code, (await newUser("wronghub")).id)).rejects.toThrow("no longer available");
  });

  it("lets a removed member join again through a new invite", async () => {
    const user = await createUserWithMembership({ fullName: "Returning", username: "returning", phone: "1", password: "password123", role: "DISTRIBUTOR", hubId: seedIds.verifiedHub, organizationId: seedIds.distributor });
    const membership = (await loadAccount(user.id))!.membership!;
    await removeMember(hubAdmin, membership.id);
    const invite = await createTeamInvite(hubAdmin, { role: "DISTRIBUTOR", organizationId: seedIds.distributor }, ORIGIN);
    expect((await acceptInviteForUser(invite.code, user.id)).status).toBe("ACTIVE");
  });
});
