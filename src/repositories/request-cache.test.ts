import { describe, expect, it } from "vitest";
import { RequestCachedRepository } from "@/repositories/request-cache";
import { LocalStorageRepository } from "@/repositories/local-storage";
import { MemoryStorage } from "@/test/memory-repository";

const customer = (id: string, name: string) => ({ id, hubId: "hub-a", name, paymentTermsDays: 0, createdById: "u", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });

describe("request cache", () => {
  it("loads each list once per request, gives each caller its own copy, and reloads after a write", async () => {
    const base = new LocalStorageRepository(new MemoryStorage());
    await base.put("Customer", customer("c1", "Alpha"));
    let reads = 0;
    const counting = Object.assign(Object.create(base) as typeof base, { list: (...args: Parameters<typeof base.list>) => { reads++; return base.list(...args); } });
    const repository = new RequestCachedRepository(counting, new Map());

    const [first, second] = await Promise.all([repository.list("Customer", "hub-a"), repository.list("Customer", "hub-a")]);
    expect(reads).toBe(1);
    first.push(customer("c9", "Not saved"));
    expect(second).toHaveLength(1);

    await repository.put("Customer", customer("c2", "Beta"));
    expect((await repository.list("Customer", "hub-a")).map((item) => item.name)).toEqual(["Alpha", "Beta"]);
    expect(reads).toBe(2);
  });
});
