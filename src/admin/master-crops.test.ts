import { beforeEach, describe, expect, it } from "vitest";
import { getCropSetup } from "@/admin/hub-crop-setup";
import { addMasterCrop, listMasterCrops, setMasterCropArchived } from "@/admin/master-crops";
import { loadSeedData } from "@/dev/seed";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

describe("master crop list", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
  });

  it("lets only the tech admin add crops, with readable ids and no duplicates", async () => {
    const techAdmin = await seededAccount("techadmin");
    const crop = await addMasterCrop(techAdmin, { name: "Cocoa beans" });
    expect(crop).toMatchObject({ id: "cocoa-beans", name: "Cocoa beans", status: "ACTIVE" });
    await expect(addMasterCrop(techAdmin, { name: "cocoa beans" })).rejects.toThrow("already on the list");
    await expect(addMasterCrop(await seededAccount("hubadmin"), { name: "Coffee" })).rejects.toThrow("permission");
    expect((await listMasterCrops(techAdmin)).find((item) => item.id === "cassava")?.hubsUsing).toBe(1);
  });

  it("hides archived crops from hub setup and brings them back on restore", async () => {
    const techAdmin = await seededAccount("techadmin");
    const hubAdmin = await seededAccount("hubadmin");
    await setMasterCropArchived(techAdmin, "rice", true);
    expect((await getCropSetup(hubAdmin)).crops.map((crop) => crop.cropId)).not.toContain("rice");
    await expect(addMasterCrop(techAdmin, { name: "Rice" })).rejects.toThrow("Restore it instead");
    await setMasterCropArchived(techAdmin, "rice", false);
    expect((await getCropSetup(hubAdmin)).crops.map((crop) => crop.cropId)).toContain("rice");
  });
});
