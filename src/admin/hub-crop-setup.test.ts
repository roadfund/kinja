import { beforeEach, describe, expect, it } from "vitest";
import { getCropSetup, saveCropSetup, saveCropSetups } from "@/admin/hub-crop-setup";
import type { Account } from "@/auth/server-store";
import { loadSeedData } from "@/dev/seed";
import { listHubCropOptions } from "@/field/deliveries";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

describe("hub crop setup", () => {
  let hubAdmin: Account;

  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
    hubAdmin = await seededAccount("hubadmin");
  });

  it("lists the master crops with the hub's grades and which grades deliveries use", async () => {
    const setup = await getCropSetup(hubAdmin);
    expect(setup.currency).toBe("LRD");
    expect(setup.crops.map((crop) => crop.name)).toEqual(["Cassava", "Plantain", "Rice", "Sweet potato"]);
    expect(setup.crops.find((crop) => crop.cropId === "cassava")!.usedGradeIds).toEqual(["a"]);
  });

  it("enables a crop with grades and prices in minor units", async () => {
    const saved = await saveCropSetup(hubAdmin, { cropId: "rice", enabled: true, grades: [{ name: "Premium", priceMinorPerKg: 1500 }, { name: "Standard", priceMinorPerKg: 1100 }] });
    expect(saved.grades.map((grade) => [grade.name, grade.priceMinorPerKg, grade.currency])).toEqual([["Premium", 1500, "LRD"], ["Standard", 1100, "LRD"]]);
    expect((await listHubCropOptions(hubAdmin.hub!.id)).some((crop) => crop.cropId === "rice")).toBe(true);
    await expect(saveCropSetup(hubAdmin, { cropId: "rice", enabled: true, grades: [{ name: "A", priceMinorPerKg: 6.5 }] })).rejects.toThrow();
  });

  it("keeps grade ids when renaming or repricing, and protects grades used by deliveries", async () => {
    const before = (await getCropSetup(hubAdmin)).crops.find((crop) => crop.cropId === "cassava")!;
    const renamed = await saveCropSetup(hubAdmin, { cropId: "cassava", enabled: true, grades: before.grades.map((grade) => ({ gradeId: grade.gradeId, name: grade.gradeId === "a" ? "Grade A+" : grade.name, priceMinorPerKg: grade.priceMinorPerKg + 50 })) });
    expect(renamed.grades.find((grade) => grade.gradeId === "a")).toMatchObject({ name: "Grade A+", priceMinorPerKg: 700 });
    await expect(saveCropSetup(hubAdmin, { cropId: "cassava", enabled: true, grades: renamed.grades.filter((grade) => grade.gradeId !== "a") })).rejects.toThrow("used by recorded deliveries");
  });

  it("rejects duplicate grade names, enabling without grades, unknown crops and other roles", async () => {
    await expect(saveCropSetup(hubAdmin, { cropId: "rice", enabled: true, grades: [{ name: "A", priceMinorPerKg: 1 }, { name: "a", priceMinorPerKg: 2 }] })).rejects.toThrow("different name");
    await expect(saveCropSetup(hubAdmin, { cropId: "rice", enabled: true, grades: [] })).rejects.toThrow("at least one grade");
    await expect(saveCropSetup(hubAdmin, { cropId: "coffee", enabled: true, grades: [{ name: "A", priceMinorPerKg: 1 }] })).rejects.toThrow("master list");
    await expect(saveCropSetup(await seededAccount("cooplead"), { cropId: "rice", enabled: false, grades: [] })).rejects.toThrow("permission");
  });

  it("works while the hub is pending verification", async () => {
    const pendingAdmin = await seededAccount("pendingadmin");
    expect((await saveCropSetup(pendingAdmin, { cropId: "cassava", enabled: true, grades: [{ name: "A", priceMinorPerKg: 600 }] })).hubId).toBe(pendingAdmin.hub!.id);
  });

  it("saves several crops at once and reports a bad one without blocking the rest", async () => {
    const hubAdmin = await seededAccount("hubadmin");
    const results = await saveCropSetups(hubAdmin, { crops: [
      { cropId: "rice", enabled: true, grades: [{ name: "Premium", priceMinorPerKg: 1500 }] },
      { cropId: "plantain", enabled: true, grades: [{ name: "A", priceMinorPerKg: 900 }, { name: "a", priceMinorPerKg: 800 }] },
    ] });
    expect(results.find((result) => result.cropId === "rice")).toMatchObject({ enabled: true, grades: [{ name: "Premium", priceMinorPerKg: 1500 }] });
    expect(results.find((result) => result.cropId === "plantain")?.error).toMatch("different name");
    expect((await getCropSetup(hubAdmin)).crops.find((crop) => crop.cropId === "rice")?.enabled).toBe(true);
  });
});
