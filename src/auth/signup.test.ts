import { describe, expect, it } from "vitest";
import { SignupInput, signupErrorFor } from "@/auth/signup";

const valid = { fullName: "Ada Test", username: "ada.test", phone: "+231770001111", password: "password123", photoUrl: "data:image/jpeg;base64,AAAA" };

function errorFor(input: Record<string, string>) {
  const result = SignupInput.safeParse(input);
  return result.success ? null : signupErrorFor(result.error);
}

describe("SignupInput", () => {
  it("accepts a complete signup with or without an email", () => {
    expect(SignupInput.parse(valid).email).toBeUndefined();
    expect(SignupInput.parse({ ...valid, email: "" }).email).toBeUndefined();
    expect(SignupInput.parse({ ...valid, email: "ada@example.com" }).email).toBe("ada@example.com");
  });

  it("reports the most useful error first", () => {
    expect(errorFor({ ...valid, photoUrl: "" })).toBe("photo");
    expect(errorFor({ ...valid, username: "a b" })).toBe("username");
    expect(errorFor({ ...valid, password: "short" })).toBe("password");
    expect(errorFor({ ...valid, email: "not-an-email" })).toBe("invalid");
  });
});
