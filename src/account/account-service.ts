import { z } from "zod";
import { storedImage } from "@/domain/files";
import { storeUpload } from "@/storage/uploads";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "@/auth/password";
import { createSession, deleteSessionsForUser, type Account } from "@/auth/server-store";
import { AuthorizationError } from "@/auth/authorization";
import type { User } from "@/domain/model";
import { getRepository } from "@/repositories/server";

export const ProfileInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.union([z.literal(""), z.string().trim().email()]).optional().transform((email) => email || undefined),
  photoUrl: z.union([z.literal(""), storedImage]).optional().transform((photo) => photo || undefined),
});

// People edit only their own profile; the username stays fixed.
export async function updateProfile(account: Account, input: unknown, now = new Date()): Promise<User> {
  if (!account.user) throw new AuthorizationError("Sign in to continue", 401);
  const details = ProfileInput.parse(input);
  const user: User = { ...account.user, ...details, photoUrl: await storeUpload(details.photoUrl, "users"), updatedAt: now.toISOString() };
  await getRepository().put("User", user);
  return user;
}

export const PasswordChangeInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
  confirmPassword: z.string(),
}).refine((input) => input.newPassword === input.confirmPassword, { message: "The new passwords do not match", path: ["confirmPassword"] });

// Changing the password signs out every other device and returns a fresh session for this one.
export async function changePassword(account: Account, input: unknown, now = new Date()): Promise<string> {
  const details = PasswordChangeInput.parse(input);
  if (!(await verifyPassword(details.currentPassword, account.user.passwordHash))) throw new Error("Your current password is not correct");
  if (details.currentPassword === details.newPassword) throw new Error("Choose a password you have not used here before");
  const passwordHash = await hashPassword(details.newPassword);
  await getRepository().put("User", { ...account.user, passwordHash, passwordSalt: passwordHash.split(".")[0], updatedAt: now.toISOString() });
  await deleteSessionsForUser(account.user.id);
  return createSession(account.user.id, now);
}
