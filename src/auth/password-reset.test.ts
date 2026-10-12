import { beforeEach, describe, expect, it } from "vitest";
import { completePasswordReset, findValidReset, requestPasswordReset } from "@/auth/password-reset";
import { authenticate, createSession, createUserWithMembership, getAccountFromSession } from "@/auth/server-store";
import { listOutbox } from "@/email/outbox";
import { useMemoryRepository } from "@/test/memory-repository";

function tokenFromLatestEmail(link: string | undefined): string {
  return new URL(link!).searchParams.get("token")!;
}

describe("password reset", () => {
  beforeEach(async () => {
    useMemoryRepository();
    await createUserWithMembership({ fullName: "Musu Kollie", username: "musu", phone: "+231770000000", email: "musu@example.com", password: "old-password", role: "COOP_LEAD", hubId: "hub-1" });
  });

  it("emails a single-use link that changes the password and signs out other sessions", async () => {
    const userId = (await authenticate("musu", "old-password"))!.account.user.id;
    const otherDevice = await createSession(userId);
    await requestPasswordReset("MUSU@example.com", "http://localhost:3000");
    const [email] = await listOutbox();
    expect(email.to).toBe("musu@example.com");
    const token = tokenFromLatestEmail(email.link);

    await completePasswordReset(token, "new-password");
    expect(await authenticate("musu", "old-password")).toBeNull();
    expect(await authenticate("musu", "new-password")).not.toBeNull();
    expect(await getAccountFromSession(otherDevice)).toBeNull();
    await expect(completePasswordReset(token, "another-password")).rejects.toThrow("invalid or has expired");
  });

  it("expires links after 30 minutes and replaces older links", async () => {
    const now = new Date("2026-06-01T10:00:00.000Z");
    await requestPasswordReset("musu", "http://localhost:3000", now);
    const firstToken = tokenFromLatestEmail((await listOutbox())[0].link);
    expect(await findValidReset(firstToken, new Date("2026-06-01T10:31:00.000Z"))).toBeNull();

    await requestPasswordReset("musu", "http://localhost:3000", new Date("2026-06-01T10:05:00.000Z"));
    expect(await findValidReset(firstToken, new Date("2026-06-01T10:06:00.000Z"))).toBeNull();
  });

  it("sends nothing for unknown accounts and rejects short passwords", async () => {
    await requestPasswordReset("nobody", "http://localhost:3000");
    expect(await listOutbox()).toEqual([]);
    await expect(completePasswordReset("anything", "short")).rejects.toThrow("at least 8");
  });
});
