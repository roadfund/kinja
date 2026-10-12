import { beforeEach, describe, expect, it } from "vitest";
import { validateHubOnboarding } from "@/auth/hub-onboarding";
import { createHubAccount, dashboardPath } from "@/auth/server-store";
import { loadSeedData } from "@/dev/seed";
import { useMemoryRepository } from "@/test/memory-repository";

const valid = {
  businessName: "Totota Agro", businessCategory: "Agro-processor", yearEstablished: "2018", countryId: "lr", regionOrCounty: "Bong", physicalAddress: "Totota main road", gps: "6.998000, -9.472000",
  registrationNumber: "REG-77", registrationCertificateUrl: "data:application/pdf;base64,JVBERi0=", taxId: "", contactName: "Ada Kollie", contactTitle: "Director", contactPhone: "077 000 1234", contactEmail: "ada@example.com",
  approximateFarmerCount: "250", approximateCooperativeCount: "4", logoUrl: "", websiteOrSocialPage: "",
};

describe("hub onboarding", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
  });

  it("validates and normalizes every business detail", async () => {
    const details = await validateHubOnboarding(valid);
    expect(details).toMatchObject({ yearEstablished: 2018, contactPhone: "+231770001234", approximateFarmerCount: 250, taxId: undefined, websiteOrSocialPage: undefined });
    const { account } = await createHubAccount({ fullName: "Ada Kollie", username: "ada", phone: "+231770001234", passwordHash: "s.h", passwordSalt: "s" }, details);
    expect(account.hub).toMatchObject({ status: "PENDING_VERIFICATION", businessCategory: "Agro-processor", gps: "6.998000, -9.472000", contactPerson: { title: "Director", email: "ada@example.com" } });
    expect(dashboardPath(account)).toBe("/auth/pending");
  });

  it.each([
    ["an unknown category", { businessCategory: "Bakery" }, ""],
    ["a future year", { yearEstablished: "2999" }, ""],
    ["an unconfigured country", { countryId: "gh" }, "Kinja operates in"],
    ["a region from another country", { regionOrCounty: "Lagos" }, "region or county"],
    ["a missing certificate", { registrationCertificateUrl: "" }, ""],
    ["a non-PDF certificate", { registrationCertificateUrl: "data:text/plain;base64,aGk=" }, ""],
    ["an invalid contact phone", { contactPhone: "1234567" }, "contact phone"],
    ["a website without https", { websiteOrSocialPage: "jimmys" }, ""],
  ])("rejects %s", async (_, changes, message) => {
    await expect(validateHubOnboarding({ ...valid, ...changes })).rejects.toThrow(message);
  });
});
