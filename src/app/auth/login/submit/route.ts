import { NextResponse } from "next/server";
import { clientIp, consumeRateLimit, rateLimits, resetRateLimit } from "@/auth/rate-limit";
import { authenticate, dashboardPath, loadAccount } from "@/auth/server-store";
import { seedIfFresh } from "@/dev/seed";
import { acceptInviteForUser } from "@/team/team-service";

function redirectTo(request: Request, path: string, sessionToken?: string) {
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  if (sessionToken) response.cookies.set("kinja_session", sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return response;
}

export async function POST(request: Request) {
  await seedIfFresh();
  const form = await request.formData();
  const username = String(form.get("username") ?? "").trim();
  const inviteCode = String(form.get("invite") ?? "").trim();
  const inviteQuery = inviteCode ? `&invite=${encodeURIComponent(inviteCode)}` : "";
  const usernameKey = `login:user:${username.toLowerCase()}`;
  const perUser = consumeRateLimit(usernameKey, rateLimits.loginPerUsername);
  const perIp = consumeRateLimit(`login:ip:${clientIp(request)}`, rateLimits.loginPerIp);
  if (!perUser.allowed || !perIp.allowed) {
    const minutes = Math.ceil(Math.max(perUser.allowed ? 0 : perUser.retryAfterSeconds, perIp.allowed ? 0 : perIp.retryAfterSeconds) / 60);
    return redirectTo(request, `/auth/login?error=locked&minutes=${minutes}${inviteQuery}`);
  }

  const result = await authenticate(username, String(form.get("password") ?? ""));
  if (!result) return redirectTo(request, `/auth/login?error=invalid${inviteQuery}`);
  resetRateLimit(usernameKey);
  let account = result.account;

  // Signing in to accept an invite: join first, then go to the new dashboard.
  if (inviteCode) {
    if (!consumeRateLimit(`invite:${clientIp(request)}`, rateLimits.invitePerIp).allowed) return redirectTo(request, `/auth/invite/${encodeURIComponent(inviteCode)}?error=limited`, result.sessionToken);
    try {
      await acceptInviteForUser(inviteCode, account.user.id);
      account = (await loadAccount(account.user.id)) ?? account;
    } catch (error) {
      const reason = error instanceof Error && error.message.startsWith("You already belong") ? "member" : "invalid";
      return redirectTo(request, `/auth/invite/${encodeURIComponent(inviteCode)}?error=${reason}`, result.sessionToken);
    }
  }

  if (!account.membership) return redirectTo(request, "/auth/login?error=nomembership");
  return redirectTo(request, dashboardPath(account), result.sessionToken);
}
