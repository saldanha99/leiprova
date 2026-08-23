import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { PROTECTED_PATH_HEADER } from "@/lib/protected-path";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    PROTECTED_PATH_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
