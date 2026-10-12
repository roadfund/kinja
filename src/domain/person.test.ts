import { describe, expect, it } from "vitest";
import { firstName, initials } from "@/domain/person";

describe("person names", () => {
  it("uses the first word of the full name as the first name", () => {
    expect(firstName("  Musu   Kollie ")).toBe("Musu");
    expect(firstName("Jay")).toBe("Jay");
    expect(firstName("")).toBe("");
  });

  it("builds initials from the first and last names", () => {
    expect(initials("Musu Ma Kollie")).toBe("MK");
    expect(initials("jay")).toBe("J");
    expect(initials(" ")).toBe("?");
  });
});
