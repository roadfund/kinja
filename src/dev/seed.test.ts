import { beforeEach, describe, expect, it } from "vitest";
import { authenticate, dashboardPath } from "@/auth/server-store";
import { loadSeedData } from "@/dev/seed";
import { useMemoryRepository } from "@/test/memory-repository";

describe("seed data", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData();
  });

  it.each([
    ["techadmin", "/dashboard/admin"],
    ["hubadmin", "/dashboard/hub"],
    ["pendingadmin", "/auth/pending"],
    ["cooplead", "/dashboard/cooperative"],
    ["fieldstaff", "/dashboard/cooperative"],
    ["manufacturer", "/dashboard/manufacturer"],
    ["distributor", "/dashboard/distributor"],
  ])("lets %s sign in and reach only their own dashboard", async (username, path) => {
    const result = await authenticate(process.env[`${username.toUpperCase()}_USERNAME`] ?? username, "kinja-dev-password");
    expect(result).not.toBeNull();
    expect(dashboardPath(result!.account)).toBe(path);
  });

  it("rejects a wrong password", async () => expect(await authenticate("cooplead", "wrong-password")).toBeNull());
});
