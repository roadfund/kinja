import { beforeEach, describe, expect, it } from "vitest";
import { getMoneyContext, listCurrencySettings, setCountryCurrencies, setExchangeRate } from "@/admin/exchange-rates";
import { loadSeedData } from "@/dev/seed";
import { seededAccount } from "@/test/accounts";
import { useMemoryRepository } from "@/test/memory-repository";

describe("currency settings", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await loadSeedData({ withValueChain: false });
  });

  it("starts Liberia on LRD and USD with a seeded rate", async () => {
    const money = await getMoneyContext({ countryId: "lr" });
    expect(money).toMatchObject({ primary: "LRD", currencies: ["LRD", "USD"] });
    expect(money.rates[0].rateTenThousandths).toBe(1_900_000);
  });

  it("lets only the tech admin change currencies and rates", async () => {
    const hubAdmin = await seededAccount("hubadmin");
    await expect(setExchangeRate(hubAdmin, { countryId: "lr", currency: "USD", rate: "200" })).rejects.toThrow("permission");
    await expect(setCountryCurrencies(hubAdmin, { countryId: "lr", extraCurrencies: [] })).rejects.toThrow("permission");
    await expect(listCurrencySettings(hubAdmin)).rejects.toThrow("permission");
  });

  it("adds a new rate without touching the old one, and turns currencies on and off", async () => {
    const techAdmin = await seededAccount("techadmin");
    await setExchangeRate(techAdmin, { countryId: "lr", currency: "USD", rate: "195.25" }, new Date("2030-01-01T00:00:00.000Z"));
    const [liberia] = await listCurrencySettings(techAdmin);
    expect(liberia.current[0]).toMatchObject({ currency: "USD", rateTenThousandths: 1_952_500 });
    expect(liberia.history[0].previousTenThousandths).toBe(1_900_000);
    await expect(setExchangeRate(techAdmin, { countryId: "lr", currency: "USD", rate: "abc" })).rejects.toThrow("number");

    await setCountryCurrencies(techAdmin, { countryId: "lr", extraCurrencies: [] });
    expect((await getMoneyContext({ countryId: "lr" })).currencies).toEqual(["LRD"]);
    await expect(setExchangeRate(techAdmin, { countryId: "lr", currency: "USD", rate: "190" })).rejects.toThrow("Turn on USD");
    await setCountryCurrencies(techAdmin, { countryId: "lr", extraCurrencies: ["USD", "EUR"] });
    expect((await getMoneyContext({ countryId: "lr" })).currencies).toEqual(["LRD", "USD", "EUR"]);
  });
});
