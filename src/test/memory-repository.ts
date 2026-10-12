import { LocalStorageRepository } from "@/repositories/local-storage";
import { setRepositoryForTesting } from "@/repositories/server";

export class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

// Points the server repository at a fresh in-memory store for one test.
export function useMemoryRepository(): LocalStorageRepository {
  const repository = new LocalStorageRepository(new MemoryStorage());
  setRepositoryForTesting(repository);
  return repository;
}
