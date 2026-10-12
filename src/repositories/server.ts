import { join } from "node:path";
import postgres from "postgres";
import { cache } from "react";
import { FileStorage } from "@/repositories/file-storage";
import { LocalStorageRepository } from "@/repositories/local-storage";
import { PostgresRepository, type SqlClient } from "@/repositories/postgres";
import type { Repository } from "@/repositories/repository";
import { RequestCachedRepository } from "@/repositories/request-cache";

// The one place that decides which store the server uses:
// - DATABASE_URL set (production on Vercel, or the import script): Postgres on Neon.
// - otherwise, in development only: a JSON file under .data/ (one machine, no setup).
// Production never falls back to the file: Vercel's file system is read-only and not shared
// between instances, so sign-in would fail silently.
//
// Only the raw connection or storage is kept on globalThis, so it survives hot reloads and
// serverless warm starts; repositories are cheap and rebuilt on each call.
type ServerData = { storage: FileStorage; isFresh: boolean };
const runtime = globalThis as typeof globalThis & { __kinjaStorage?: ServerData; __kinjaSql?: { sql: ReturnType<typeof postgres>; client: SqlClient }; __kinjaTestRepository?: Repository };

export const usesDatabase = () => Boolean(process.env.DATABASE_URL);

function serverData(): ServerData {
  if (!runtime.__kinjaStorage) {
    const storage = new FileStorage(process.env.KINJA_DATA_FILE ?? join(process.cwd(), ".data", "kinja.json"));
    runtime.__kinjaStorage = { storage, isFresh: !storage.existedAtStart };
  }
  return runtime.__kinjaStorage;
}

function databaseRepository(): Repository {
  // prepare: false works with Neon's pooled (PgBouncer) connection string. One client per
  // server instance, so the table is set up once and connections are reused.
  if (!runtime.__kinjaSql) {
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: Number(process.env.DATABASE_MAX_CONNECTIONS ?? 10), idle_timeout: 20, onnotice: () => {} });
    runtime.__kinjaSql = { sql, client: { query: (text, params = []) => sql.unsafe(text, params as never[]) as never } };
  }
  return new PostgresRepository(runtime.__kinjaSql.client);
}

function storeRepository(): Repository {
  if (usesDatabase()) return databaseRepository();
  if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is not set. Production needs the Neon Postgres database: add DATABASE_URL to the Vercel project's environment variables.");
  return new LocalStorageRepository(serverData().storage);
}

// One cache per page render (React's request-scoped cache). Outside a render (API routes,
// scripts, tests) React gives a fresh map on every call, so nothing is ever cached there.
const requestCache = cache(() => new Map<string, Promise<unknown>>());

export function getRepository(): Repository {
  if (runtime.__kinjaTestRepository) return runtime.__kinjaTestRepository;
  return new RequestCachedRepository(storeRepository(), requestCache());
}

// True when the local data file did not exist when the server started (a fresh checkout).
export function isFreshDataStore(): boolean {
  return runtime.__kinjaTestRepository || usesDatabase() ? false : serverData().isFresh;
}

export function setRepositoryForTesting(repository: Repository): void {
  runtime.__kinjaTestRepository = repository;
}
