import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/auth/password";

export const SignupInput = z.object({
  fullName: z.string().trim().min(2),
  username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,32}$/),
  phone: z.string().trim().min(7),
  email: z.union([z.literal(""), z.string().trim().email()]).optional().transform((email) => email || undefined),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  photoUrl: z.string().startsWith("data:image/").max(300_000),
});
export type SignupInput = z.infer<typeof SignupInput>;

export const signupErrors = {
  invalid: "Some details are missing or invalid. Check each field and try again.",
  photo: "Add a profile photo to continue.",
  password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  username: "Usernames are 3 to 32 letters, numbers, dots, dashes or underscores.",
  taken: "That username is already taken. Choose another one.",
  limited: "Too many attempts. Please wait a while and try again.",
  invite: "This invite is no longer valid. Ask the person who invited you for a new one.",
} as const;
export type SignupError = keyof typeof signupErrors;

export function signupErrorFor(error: z.ZodError): SignupError {
  const fields = new Set(error.issues.map((issue) => issue.path[0]));
  if (fields.has("photoUrl")) return "photo";
  if (fields.has("username")) return "username";
  if (fields.has("password")) return "password";
  return "invalid";
}
