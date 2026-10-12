import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateHubOnboarding } from "@/auth/hub-onboarding";
import { apiErrorResponse } from "@/auth/route-authorization";
import { consumePendingSignup, createHubAccount } from "@/auth/server-store";

export async function POST(request: Request) {
  try {
    const details = await validateHubOnboarding(await request.json());
    const token = (await cookies()).get("kinja_pending_signup")?.value;
    const signup = token ? await consumePendingSignup(token) : null;
    if (!signup) return Response.json({ error: "Your sign-up session expired. Please create your account again.", restart: true }, { status: 410 });
    const { sessionToken } = await createHubAccount(signup, details);
    const response = NextResponse.json({ redirect: "/auth/pending" });
    response.cookies.set("kinja_session", sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
    response.cookies.delete("kinja_pending_signup");
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
