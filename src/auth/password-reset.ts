import { createUuidV7 } from "@/domain/id";
import type { PasswordReset } from "@/domain/model";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/auth/password";
import { deleteSessionsForUser, findUserByUsernameOrEmail } from "@/auth/server-store";
import { createToken, hashToken } from "@/auth/tokens";
import { sendEmail } from "@/email/outbox";
import { getRepository } from "@/repositories/server";

const RESET_TTL_MS = 30 * 60 * 1000;

// Always behaves the same whether or not the account exists, so the response
// cannot be used to discover usernames or emails.
export async function requestPasswordReset(identifier: string, origin: string, now = new Date()): Promise<void> {
  const user = await findUserByUsernameOrEmail(identifier);
  if (!user?.email) return;

  const repository = getRepository();
  const timestamp = now.toISOString();
  for (const reset of await repository.list("PasswordReset")) {
    if (reset.userId === user.id && !reset.usedAt) await repository.put("PasswordReset", { ...reset, usedAt: timestamp, updatedAt: timestamp });
  }

  const token = createToken();
  await repository.put("PasswordReset", { id: createUuidV7(), tokenHash: await hashToken(token), userId: user.id, expiresAt: new Date(now.getTime() + RESET_TTL_MS).toISOString(), createdById: user.id, createdAt: timestamp, updatedAt: timestamp });
  const link = `${origin}/auth/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, subject: "Reset your Kinja password", text: `Hi ${user.fullName},\n\nUse the link below to choose a new password. It expires in 30 minutes and can only be used once.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`, link }, now);
}

export async function findValidReset(token: string, now = new Date()): Promise<PasswordReset | null> {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const reset = (await getRepository().list("PasswordReset")).find((item) => item.tokenHash === tokenHash);
  return reset && !reset.usedAt && new Date(reset.expiresAt) > now ? reset : null;
}

export async function completePasswordReset(token: string, password: string, now = new Date()): Promise<void> {
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  const reset = await findValidReset(token, now);
  if (!reset) throw new Error("This reset link is invalid or has expired");

  const repository = getRepository();
  const user = await repository.get("User", reset.userId);
  if (!user) throw new Error("This reset link is invalid or has expired");

  const timestamp = now.toISOString();
  const passwordHash = await hashPassword(password);
  await repository.put("User", { ...user, passwordHash, passwordSalt: passwordHash.split(".")[0], updatedAt: timestamp });
  await repository.put("PasswordReset", { ...reset, usedAt: timestamp, updatedAt: timestamp });
  await deleteSessionsForUser(user.id);
}
