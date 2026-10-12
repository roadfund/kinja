import { EntitySchemas, type EntityName, type EntityOf } from "@/domain/model";
import type { Repository } from "@/repositories/repository";

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "kinja:v1:";

export class LocalStorageRepository implements Repository {
  constructor(private readonly storage: Storage) {}

  async list<T extends EntityName>(entity: T, hubId?: string): Promise<Array<EntityOf<T>>> {
    const values = this.read(entity);
    return hubId ? values.filter((value) => "hubId" in value && value.hubId === hubId) : values;
  }

  async get<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<EntityOf<T> | null> {
    const value = this.read(entity).find((item) => item.id === id);
    if (!value || (hubId && "hubId" in value && value.hubId !== hubId)) return null;
    return value;
  }

  async put<T extends EntityName>(entity: T, value: EntityOf<T>): Promise<void> {
    const parsed = EntitySchemas[entity].parse(value) as EntityOf<T>;
    const values = this.read(entity).filter((item) => item.id !== parsed.id);
    this.write(entity, [...values, parsed]);
  }

  async putMany<T extends EntityName>(entity: T, values: Array<EntityOf<T>>): Promise<void> {
    const parsed = values.map((value) => EntitySchemas[entity].parse(value) as EntityOf<T>);
    const ids = new Set(parsed.map((value) => value.id));
    this.write(entity, [...this.read(entity).filter((item) => !ids.has(item.id)), ...parsed]);
  }

  async remove<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<void> {
    const values = this.read(entity);
    const target = values.find((item) => item.id === id);
    if (!target || (hubId && "hubId" in target && target.hubId !== hubId)) return;
    this.write(entity, values.filter((item) => item.id !== id));
  }

  async clear(): Promise<void> {
    for (const entity of Object.keys(EntitySchemas)) this.storage.removeItem(this.key(entity));
  }

  private read<T extends EntityName>(entity: T): Array<EntityOf<T>> {
    const raw = this.storage.getItem(this.key(entity));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error(`Invalid ${entity} repository data`);
    return parsed.map((value) => EntitySchemas[entity].parse(value)) as Array<EntityOf<T>>;
  }

  private write<T extends EntityName>(entity: T, values: Array<EntityOf<T>>): void {
    try {
      this.storage.setItem(this.key(entity), JSON.stringify(values));
    } catch (error) {
      throw new Error("Kinja storage quota exceeded", { cause: error });
    }
  }

  private key(entity: string): string {
    return `${STORAGE_PREFIX}${STORAGE_VERSION}:${entity}`;
  }
}