import { NextResponse } from "next/server";
import { devToolsNotFound } from "@/dev/guard";
import { clearAllData } from "@/dev/seed";

export async function POST(request: Request) {
  const blocked = devToolsNotFound();
  if (blocked) return blocked;
  await clearAllData();
  const response = NextResponse.redirect(new URL("/dev?done=cleared", request.url), 303);
  response.cookies.delete("kinja_session");
  return response;
}
