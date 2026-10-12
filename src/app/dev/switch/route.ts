import { NextResponse } from "next/server";
import { createSession, dashboardPath, loadAccount } from "@/auth/server-store";
import { devToolsNotFound } from "@/dev/guard";

export async function POST(request: Request) {
  const blocked = devToolsNotFound();
  if (blocked) return blocked;
  const account = await loadAccount(String((await request.formData()).get("userId") ?? ""));
  if (!account) return NextResponse.redirect(new URL("/dev", request.url), 303);
  const response = NextResponse.redirect(new URL(dashboardPath(account), request.url), 303);
  response.cookies.set("kinja_session", await createSession(account.user.id), { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/" });
  return response;
}
