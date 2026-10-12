import { beforeEach, describe, expect, it } from "vitest";
import { listPendingHubs, reviewHubById } from "@/admin/hub-review-service";
import type { Account } from "@/auth/server-store";
import { loadSeedData, seedIds } from "@/dev/seed";
import { getRepository } from "@/repositories/server";
import { useMemoryRepository } from "@/test/memory-repository";

const audit = { createdById: "system", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const user = { id: "tech-admin", fullName: "Tech", username: "tech", phone: "", passwordHash: "x.y", passwordSalt: "x", ...audit };
const techAdmin: Account = { user, membership: { id: "m", userId: user.id, hubId: "platform", role: "TECH_ADMIN", status: "ACTIVE", ...audit } };

describe("reviewHubById", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData();
  });

  it("verifies a pending hub and records the decision", async () => {
    expect((await listPendingHubs(techAdmin)).map((hub) => hub.id)).toEqual([seedIds.pendingHub]);
    const hub = await reviewHubById(techAdmin, { hubId: seedIds.pendingHub, decision: "VERIFIED" });
    expect(hub.status).toBe("VERIFIED");
    expect(await getRepository().list("HubVerification")).toHaveLength(1);
    expect(await listPendingHubs(techAdmin)).toEqual([]);
  });

  it("is refused for anyone but a tech admin", async () => {
    const hubAdmin: Account = { ...techAdmin, membership: { ...techAdmin.membership!, role: "HUB_ADMIN", hubId: seedIds.pendingHub }, hub: (await getRepository().get("Hub", seedIds.pendingHub))! };
    await expect(reviewHubById(hubAdmin, { hubId: seedIds.pendingHub, decision: "VERIFIED" })).rejects.toThrow("permission");
  });
});
