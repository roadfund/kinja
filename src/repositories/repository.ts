import type { EntityName, EntityOf } from "@/domain/model";

// Every data store (localStorage today, a real database later) implements this.
// Passing hubId scopes the call to one hub: records from other hubs are invisible.
export interface Repository {
  list<T extends EntityName>(entity: T, hubId?: string): Promise<Array<EntityOf<T>>>;
  get<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<EntityOf<T> | null>;
  put<T extends EntityName>(entity: T, value: EntityOf<T>): Promise<void>;
  // Saves many records in one write (for imports); each is validated like put.
  putMany<T extends EntityName>(entity: T, values: Array<EntityOf<T>>): Promise<void>;
  remove<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<void>;
  clear(): Promise<void>;
}
