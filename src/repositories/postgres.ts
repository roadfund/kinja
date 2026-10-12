import { EntitySchemas, type EntityName, type EntityOf } from "@/domain/model";
import type { Repository } from "@/repositories/repository";

// Postgres storage for production (Neon). Every record lives in one table as validated JSON,
// keyed by its collection and id, so the repository interface, services and screens are the
// same as with the local file store. Plain SQL, no ORM.
//
//   kinja_records(entity, id, hub_id, data jsonb, updated_at)   primary key (entity, id)

// The one thing the adapter needs from a driver: run a statement with parameters, get rows.
export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

type Row = { data: unknown };
// Table setup runs once per database client (not per repository), and tolerates another
// server instance creating the same table or index at the same moment.
const setups = new WeakMap<SqlClient, Promise<void>>();
const alreadyExists = (error: unknown) => typeof error === "object" && error !== null && "code" in error && ["42P07", "23505"].includes(String((error as { code: unknown }).code));
const hubIdOf = (value: object) => ("hubId" in value && typeof value.hubId === "string" ? value.hubId : null);

export class PostgresRepository implements Repository {
  constructor(private readonly db: SqlClient) {}

  // Creates the table on first use; safe to run on every cold start.
  private async init(): Promise<void> {
    let setup = setups.get(this.db);
    if (!setup) {
      setup = (async () => {
        for (const statement of ["create table if not exists kinja_records (entity text not null, id text not null, hub_id text, data jsonb not null, updated_at timestamptz not null default now(), primary key (entity, id))", "create index if not exists kinja_records_entity_hub on kinja_records (entity, hub_id)"]) {
          try { await this.db.query(statement); } catch (error) { if (!alreadyExists(error)) throw error; }
        }
      })();
      setups.set(this.db, setup);
      setup.catch(() => setups.delete(this.db));
    }
    return setup;
  }

  // Validate on read too, so corrupted or outdated data fails loudly.
  private parse<T extends EntityName>(entity: T, rows: Row[]): Array<EntityOf<T>> {
    return rows.map((row) => EntitySchemas[entity].parse(typeof row.data === "string" ? JSON.parse(row.data) : row.data) as EntityOf<T>);
  }

  async list<T extends EntityName>(entity: T, hubId?: string): Promise<Array<EntityOf<T>>> {
    await this.init();
    // UUIDv7 ids sort by creation time, so this matches the file store's insertion order.
    const rows = hubId
      ? await this.db.query<Row>("select data from kinja_records where entity = $1 and hub_id = $2 order by id", [entity, hubId])
      : await this.db.query<Row>("select data from kinja_records where entity = $1 order by id", [entity]);
    return this.parse(entity, rows);
  }

  async get<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<EntityOf<T> | null> {
    await this.init();
    const rows = await this.db.query<Row & { hub_id: string | null }>("select data, hub_id from kinja_records where entity = $1 and id = $2", [entity, id]);
    if (!rows[0] || (hubId && rows[0].hub_id !== null && rows[0].hub_id !== hubId)) return null;
    return this.parse(entity, rows)[0];
  }

  async put<T extends EntityName>(entity: T, value: EntityOf<T>): Promise<void> {
    await this.putMany(entity, [value]);
  }

  // Validates every record, then upserts them all in one statement.
  async putMany<T extends EntityName>(entity: T, values: Array<EntityOf<T>>): Promise<void> {
    if (values.length === 0) return;
    await this.init();
    const parsed = values.map((value) => EntitySchemas[entity].parse(value) as EntityOf<T> & { id: string });
    for (let start = 0; start < parsed.length; start += 500) {
      const chunk = parsed.slice(start, start + 500).map((value) => ({ id: value.id, hubId: hubIdOf(value), data: value }));
      await this.db.query(
        `insert into kinja_records (entity, id, hub_id, data)
         select $1, item->>'id', item->>'hubId', item->'data' from jsonb_array_elements($2::text::jsonb) as item
         on conflict (entity, id) do update set hub_id = excluded.hub_id, data = excluded.data, updated_at = now()`,
        [entity, JSON.stringify(chunk)],
      );
    }
  }

  async remove<T extends EntityName>(entity: T, id: string, hubId?: string): Promise<void> {
    await this.init();
    if (hubId) await this.db.query("delete from kinja_records where entity = $1 and id = $2 and (hub_id = $3 or hub_id is null)", [entity, id, hubId]);
    else await this.db.query("delete from kinja_records where entity = $1 and id = $2", [entity, id]);
  }

  async clear(): Promise<void> {
    await this.init();
    await this.db.query("delete from kinja_records");
  }
}
