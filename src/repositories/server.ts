import { join } from "node:path";
import { FileStorage } from "@/repositories/file-storage";
import { LocalStorageRepository } from "@/repositories/local-storage";
import type { Repository } from "@/repositories/repository";

// The one place that decides which store the server uses. When a database is
// chosen, return its Repository implementation here and nothing else changes.
//
// Only the raw storage is kept on globalThis. The repository is rebuilt on each
// call so it always validates with the current schemas, even after hot reloads.
type ServerData = { storage: FileStorage; isFresh: boolean };
const runtime = globalThis as typeof globalThis & { __kinjaStorage?: ServerData; __kinjaTestRepository?: Repository };

function serverData(): ServerData {
  if (!runtime.__kinjaStorage) {
    const storage = new FileStorage(process.env.KINJA_DATA_FILE ?? join(process.cwd(), ".data", "kinja.json"));
    runtime.__kinjaStorage = { storage, isFresh: !storage.existedAtStart };
  }
  return runtime.__kinjaStorage;
}

export function getRepository(): Repository {
  return runtime.__kinjaTestRepository ?? new LocalStorageRepository(serverData().storage);
}

// True when the data file did not exist when the server started (a fresh checkout).
export function isFreshDataStore(): boolean {
  return runtime.__kinjaTestRepository ? false : serverData().isFresh;
}

export function setRepositoryForTesting(repository: Repository): void {
  runtime.__kinjaTestRepository = repository;
}
