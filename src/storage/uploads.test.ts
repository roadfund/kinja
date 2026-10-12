import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORED_FILE } from "@/domain/files";
import { registerFarmer } from "@/field/farmers";
import { setObjectStoreForTesting, type ObjectStore } from "@/storage/object-store";
import { storeUpload } from "@/storage/uploads";
import { useMemoryRepository } from "@/test/memory-repository";

const png = `data:image/png;base64,${Buffer.from("fake png bytes").toString("base64")}`;

describe("uploads in object storage", () => {
  let saved: Array<{ key: string; body: string; contentType: string }>;

  beforeEach(() => {
    saved = [];
    const store: ObjectStore = { put: async (key, body, contentType) => { saved.push({ key, body: Buffer.from(body).toString(), contentType }); }, signedUrl: async (key) => `https://bucket.example/${key}?signed` };
    setObjectStoreForTesting(store);
  });
  afterEach(() => setObjectStoreForTesting(undefined));

  it("puts the file in the bucket and keeps only a short path", async () => {
    const path = await storeUpload(png, "users");
    expect(path).toMatch(STORED_FILE);
    expect(path).toMatch(/^\/files\/users\/.+\.png$/);
    expect(saved).toEqual([{ key: path!.slice("/files/".length), body: "fake png bytes", contentType: "image/png" }]);
  });

  it("leaves stored paths and empty values alone, and refuses other file types", async () => {
    expect(await storeUpload("/files/users/01a12fc2-cdb2-7000-b73a-000000000000.png", "users")).toBe("/files/users/01a12fc2-cdb2-7000-b73a-000000000000.png");
    expect(await storeUpload(undefined, "logos")).toBeUndefined();
    await expect(storeUpload("data:text/html;base64,PGgxPg==", "logos")).rejects.toThrow("JPEG, PNG or WebP");
    expect(saved).toHaveLength(0);
  });

  it("stores a farmer's photo through the normal registration", async () => {
    useMemoryRepository();
    const farmer = await registerFarmer({ fullName: "Mariama Kromah", gender: "FEMALE", age: 42, community: "Gbarnga", photoUrl: png, topCrops: [{ crop: "Cassava", status: "ALREADY_GROWS" }], plots: [{ description: "River plot", village: "Gbarnga", size: 2.5, unit: "ACRES", tenure: "OWNED", crops: ["Cassava"] }], incomeSource: "Farming only" }, { hubId: "hub-a", cooperativeId: "coop-a", userId: "user-1" });
    expect(farmer.photoUrl).toMatch(/^\/files\/farmers\/.+\.png$/);
  });

  it("keeps the data URL when no bucket is configured (local development)", async () => {
    setObjectStoreForTesting(null);
    expect(await storeUpload(png, "users")).toBe(png);
  });
});
