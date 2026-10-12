import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { authenticate, getAccountFromSession } from "@/auth/server-store";
import { loadSeedData, seedIds } from "@/dev/seed";
import { orderDashboard } from "@/market/orders";
import { PostgresRepository } from "@/repositories/postgres";
import { setRepositoryForTesting } from "@/repositories/server";
import { seededAccount } from "@/test/accounts";

// The production adapter against a real Postgres engine (PGlite, in-process).
describe("Postgres repository", () => {
  let repository: PostgresRepository;

  beforeAll(async () => {
    const db = new PGlite();
    repository = new PostgresRepository({ query: async (text, params) => (await db.query(text, params)).rows as never });
    setRepositoryForTesting(repository);
    await loadSeedData();
  }, 60_000);

  it("stores the whole demo seed and signs people in with a session", async () => {
    expect((await repository.list("User")).length).toBeGreaterThan(5);
    const result = await authenticate("distributor", "kinja-dev-password");
    expect(result?.account.membership?.role).toBe("DISTRIBUTOR");
    expect((await getAccountFromSession(result!.sessionToken))?.user.username).toBe("distributor");
    expect(await authenticate("distributor", "wrong")).toBeNull();
  });

  it("keeps hubs isolated and validates every record", async () => {
    const order = (await repository.list("Order", seedIds.verifiedHub))[0];
    expect(await repository.get("Order", order.id, seedIds.verifiedHub)).toMatchObject({ id: order.id });
    expect(await repository.get("Order", order.id, seedIds.pendingHub)).toBeNull();
    expect(await repository.list("Order", seedIds.pendingHub)).toEqual([]);
    await expect(repository.put("Order", { ...order, number: -1 })).rejects.toThrow();
  });

  it("upserts, lists in creation order, and removes", async () => {
    const before = await repository.list("Customer", seedIds.verifiedHub);
    await repository.putMany("Customer", before.map((customer) => ({ ...customer, name: `${customer.name}!` })));
    const after = await repository.list("Customer", seedIds.verifiedHub);
    expect(after.map((customer) => customer.id)).toEqual(before.map((customer) => customer.id));
    expect(after.every((customer) => customer.name.endsWith("!"))).toBe(true);
    await repository.remove("Customer", after[0].id, seedIds.pendingHub);
    expect(await repository.get("Customer", after[0].id)).not.toBeNull();
    await repository.remove("Customer", after[0].id, seedIds.verifiedHub);
    expect(await repository.get("Customer", after[0].id)).toBeNull();
  });

  it("serves the dashboards", async () => {
    const { summary } = await orderDashboard(await seededAccount("hubadmin"));
    expect(summary.total.orders).toBeGreaterThan(0);
  });
});
