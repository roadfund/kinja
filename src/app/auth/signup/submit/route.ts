import { NextResponse } from "next/server";
import { hashPassword } from "@/auth/password";
import { clientIp, consumeRateLimit, rateLimits } from "@/auth/rate-limit";
import { createSession, createUser, dashboardPath, findUserByUsername, loadAccount, savePendingSignup } from "@/auth/server-store";
import { SignupInput, signupErrorFor, type SignupError } from "@/auth/signup";
import { getRepository } from "@/repositories/server";
import { acceptInviteForUser, getInvitePreview } from "@/team/team-service";

function backToSignup(request: Request, error: SignupError) {
  const url = new URL(`/auth/signup?error=${error}`, request.url);
  const invite = new URL(request.url).searchParams.get("invite");
  if (invite) url.searchParams.set("invite", invite);
  return NextResponse.redirect(url, 303);
}

function withSession(response: NextResponse, token: string) {
  response.cookies.set("kinja_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return response;
}

export async function POST(request: Request) {
  if (!consumeRateLimit(`signup:${clientIp(request)}`, rateLimits.signupPerIp).allowed) return backToSignup(request, "limited");

  const form = await request.formData();
  const parsed = SignupInput.safeParse(Object.fromEntries([...form].map(([key, value]) => [key, String(value)])));
  if (!parsed.success) return backToSignup(request, signupErrorFor(parsed.error));
  const { password, ...details } = parsed.data;
  if (await findUserByUsername(details.username)) return backToSignup(request, "taken");
  const passwordHash = await hashPassword(password);
  const signup = { ...details, passwordHash, passwordSalt: passwordHash.split(".")[0] };

  // Joining by invite: create the account and the membership, then go straight to the dashboard.
  const inviteCode = new URL(request.url).searchParams.get("invite");
  if (inviteCode) {
    if (!consumeRateLimit(`invite:${clientIp(request)}`, rateLimits.invitePerIp).allowed) return backToSignup(request, "limited");
    if ((await getInvitePreview(inviteCode))?.status !== "ACTIVE") return backToSignup(request, "invite");
    const user = await createUser(signup);
    try {
      await acceptInviteForUser(inviteCode, user.id);
    } catch {
      await getRepository().remove("User", user.id);
      return backToSignup(request, "invite");
    }
    const account = await loadAccount(user.id);
    return withSession(NextResponse.redirect(new URL(dashboardPath(account!), request.url), 303), await createSession(user.id));
  }

  // Starting a hub: details wait while the person fills in onboarding.
  const token = savePendingSignup(signup);
  const response = NextResponse.redirect(new URL("/auth/onboarding", request.url), 303);
  response.cookies.set("kinja_pending_signup", token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60, path: "/" });
  return response;
}
