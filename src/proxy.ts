import { NextResponse, type NextRequest } from "next/server";

// Passes the address bar's query string to server rendering, so shared components such as
// tables can read their page and search (?<table>.page=2) without every page threading it.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-kinja-search", request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
