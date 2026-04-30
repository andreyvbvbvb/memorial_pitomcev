import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "access_token";

export function middleware(request: NextRequest) {
  if (request.cookies.has(AUTH_COOKIE)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/auth";
  redirectUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/create/:path*", "/my-pets/:path*", "/profile/:path*", "/admin/sql/:path*"]
};
