import { beforeEach, describe, expect, it } from "vitest";
import { changePassword, updateProfile } from "@/account/account-service";
import { authenticate, createSession, createUserWithMembership, getAccountFromSession, loadAccount, type Account } from "@/auth/server-store";
import { useMemoryRepository } from "@/test/memory-repository";

describe("account self-service", () => {
  let account: Account;

  beforeEach(async () => {
    useMemoryRepository();
    const user = await createUserWithMembership({ fullName: "Musu Kollie", username: "musu", phone: "+231770000000", password: "old-password", role: "COOP_LEAD", hubId: "hub-1" });
    account = (await loadAccount(user.id))!;
  });

  it("updates name, phone, email and photo but never the username", async () => {
    const user = await updateProfile(account, { fullName: "Musu K. Kollie", phone: "+231770001111", email: "musu@example.com", photoUrl: "data:image/jpeg;base64,AAAA", username: "hijack" });
    expect(user).toMatchObject({ fullName: "Musu K. Kollie", phone: "+231770001111", email: "musu@example.com", username: "musu" });
    expect((await updateProfile(account, { fullName: "Musu Kollie", phone: "+231770001111", email: "" })).email).toBeUndefined();
    await expect(updateProfile(account, { fullName: "M", phone: "1" })).rejects.toThrow();
  });

  it("changes the password after checking the current one, and signs out other devices", async () => {
    const otherDevice = await createSession(account.user.id);
    await expect(changePassword(account, { currentPassword: "wrong", newPassword: "new-password", confirmPassword: "new-password" })).rejects.toThrow("not correct");
    await expect(changePassword(account, { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "different" })).rejects.toThrow();
    const thisDevice = await changePassword(account, { currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" });
    expect(await getAccountFromSession(otherDevice)).toBeNull();
    expect(await getAccountFromSession(thisDevice)).not.toBeNull();
    expect(await authenticate("musu", "old-password")).toBeNull();
    expect(await authenticate("musu", "new-password")).not.toBeNull();
  });
});
