import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/auth/server-store";

export async function GET(request: Request) {
  await deleteSession((await cookies()).get("kinja_session")?.value);
  const response = NextResponse.redirect(new URL("/auth/login", request.url), 303);
  response.cookies.delete("kinja_session");
  return response;
}
