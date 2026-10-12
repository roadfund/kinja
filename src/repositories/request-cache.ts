import type { EntityName, EntityOf } from "@/domain/model";
import type { Repository } from "@/repositories/repository";

// Loads each kind of record once per page render. A dashboard asks for the same lists from
// several services (sales, invoices, orders all read Sale, Customer...); without this, each
// asked the database again. The cache lives for one request only (see server.ts), and any
// write in that request clears the affected entity, so reads never go stale.
export class RequestCachedRepository implements Repository {
  constructor(private readonly base: Repository, private readonly cache: Map<string, Promise<unknown>>) {}

  private remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) {
      const promise = load();
      this.cache.set(key, promise);
      promise.catch(() => this.cache.delete(key));
    }
    return this.cache.get(key) as Promise<T>;
  }

  private forget(entity: EntityName) {
    for (const key of this.cache.keys()) if (key.startsWith(`${entity}|`)) this.cache.delete(key);
  }

  list<T extends EntityName>(entity: T, hubId?: string): Promise<Array<EntityOf<T>>> {
    // Each caller gets its own array, so sorting one never reorders another's.
    return this.remember(`${entity}|list|${hubId ?? "*"}`, () => this.base.list(entity, hubId)).then((rows) => rows.slice());
  }

  get<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<EntityOf<T> | null> {
    return this.remember(`${entity}|get|${id}|${hubId ?? "*"}`, () => this.base.get(entity, id, hubId));
  }

  async put<T extends EntityName>(entity: T, value: EntityOf<T>): Promise<void> {
    this.forget(entity);
    await this.base.put(entity, value);
  }

  async putMany<T extends EntityName>(entity: T, values: Array<EntityOf<T>>): Promise<void> {
    this.forget(entity);
    await this.base.putMany(entity, values);
  }

  async remove<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<void> {
    this.forget(entity);
    await this.base.remove(entity, id, hubId);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    await this.base.clear();
  }
}
