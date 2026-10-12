import { NextResponse } from "next/server";
import { devToolsNotFound } from "@/dev/guard";
import { loadSeedData } from "@/dev/seed";

export async function POST(request: Request) {
  const blocked = devToolsNotFound();
  if (blocked) return blocked;
  try {
    await loadSeedData();
  } catch (error) {
    return new Response(`Could not load demo data:\n${error instanceof Error ? error.stack ?? error.message : String(error)}`, { status: 500 });
  }
  return NextResponse.redirect(new URL("/dev?done=seeded", request.url), 303);
}
