import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/auth/password-reset";
import { clientIp, consumeRateLimit, rateLimits } from "@/auth/rate-limit";

export async function POST(request: Request) {
  const identifier = String((await request.formData()).get("identifier") ?? "").trim();
  const perAccount = consumeRateLimit(`reset:account:${identifier.toLowerCase()}`, rateLimits.resetPerAccount);
  const perIp = consumeRateLimit(`reset:ip:${clientIp(request)}`, rateLimits.resetPerIp);
  if (!perAccount.allowed || !perIp.allowed) return NextResponse.redirect(new URL("/auth/reset-password?error=limited", request.url), 303);

  if (identifier) await requestPasswordReset(identifier, new URL(request.url).origin);
  return NextResponse.redirect(new URL("/auth/reset-password?sent=1", request.url), 303);
}
