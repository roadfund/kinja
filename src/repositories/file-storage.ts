import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// A Web Storage implementation backed by a JSON file, so the server can use the
// same LocalStorageRepository (keys, versioning, validation) as the browser.
export class FileStorage implements Storage {
  private values = new Map<string, string>();
  private loadedAt = 0;
  readonly existedAtStart: boolean;

  constructor(private readonly path: string) {
    this.existedAtStart = existsSync(path);
    this.reloadIfChanged();
  }

  get length() { this.reloadIfChanged(); return this.values.size; }
  key(index: number) { this.reloadIfChanged(); return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { this.reloadIfChanged(); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.reloadIfChanged(); this.values.set(key, value); this.flush(); }
  removeItem(key: string) { this.reloadIfChanged(); this.values.delete(key); this.flush(); }
  clear() { this.values.clear(); this.flush(); }

  // Another module instance may have written the file since we last read it.
  private reloadIfChanged(): void {
    if (!existsSync(this.path)) return;
    const modifiedAt = statSync(this.path).mtimeMs;
    if (modifiedAt === this.loadedAt) return;
    const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
    this.values = new Map(Object.entries(parsed as Record<string, string>));
    this.loadedAt = modifiedAt;
  }

  // Write to a temp file then rename, so a crash never leaves half a file behind.
  private flush(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(Object.fromEntries(this.values)));
    renameSync(temp, this.path);
    this.loadedAt = statSync(this.path).mtimeMs;
  }
}
