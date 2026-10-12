import { NextResponse } from "next/server";
import { PASSWORD_MIN_LENGTH } from "@/auth/password";
import { completePasswordReset } from "@/auth/password-reset";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const retry = (error: string) => NextResponse.redirect(new URL(`/auth/reset-password?token=${encodeURIComponent(token)}&error=${error}`, request.url), 303);

  if (password.length < PASSWORD_MIN_LENGTH) return retry("short");
  if (password !== String(form.get("confirm") ?? "")) return retry("mismatch");
  try {
    await completePasswordReset(token, password);
  } catch {
    // The page shows the "link expired" state when the token is no longer valid.
    return retry("invalid");
  }
  const response = NextResponse.redirect(new URL("/auth/login?reset=1", request.url), 303);
  response.cookies.delete("kinja_session");
  return response;
}
