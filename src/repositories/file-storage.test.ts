import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSeedData } from "@/dev/seed";
import { FileStorage } from "@/repositories/file-storage";
import { LocalStorageRepository } from "@/repositories/local-storage";
import { setRepositoryForTesting } from "@/repositories/server";

describe("FileStorage", () => {
  it("persists repository data across instances", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "kinja-")), "data.json");
    setRepositoryForTesting(new LocalStorageRepository(new FileStorage(path)));
    await loadSeedData();

    const reopened = new LocalStorageRepository(new FileStorage(path));
    expect(await reopened.list("User")).toHaveLength(7);
    expect(await reopened.list("Farmer")).toHaveLength(4);
    expect(await reopened.list("Delivery")).toHaveLength(4);
  });
});
