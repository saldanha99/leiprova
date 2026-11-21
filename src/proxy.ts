import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { PROTECTED_PATH_HEADER } from "@/lib/protected-path";
import { canonicalLegalRequestPath } from "@/lib/seo/slugs";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Spec 2.3: article spellings and known law aliases answer 301 to the canonical URL.
  if (pathname.toLowerCase().startsWith("/lei/")) {
    const canonical = canonicalLegalRequestPath(pathname);
    if (!canonical) return NextResponse.next();
    const target = request.nextUrl.clone();
    target.pathname = canonical;
    return NextResponse.redirect(target, 301);
  }

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
  matcher: ["/app/:path*", "/admin/:path*", "/lei/:path*", "/Lei/:path*", "/LEI/:path*"],
};
