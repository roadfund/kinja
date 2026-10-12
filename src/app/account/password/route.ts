import { NextResponse } from "next/server";
import { changePassword } from "@/account/account-service";
import { apiErrorResponse, requireApiAccount } from "@/auth/route-authorization";

export async function POST(request: Request) {
  try {
    const sessionToken = await changePassword(await requireApiAccount(), await request.json());
    const response = NextResponse.json({ ok: true });
    response.cookies.set("kinja_session", sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7, path: "/" });
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
