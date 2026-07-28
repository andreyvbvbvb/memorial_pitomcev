import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "access_token";
const CANONICAL_HOST = "meowgav.ru";
const REDIRECT_HOSTS = new Set([
  "xn--80aeb9a9a9d.com",
  "www.xn--80aeb9a9a9d.com",
  "мяугав.com",
  "www.мяугав.com",
  "www.meowgav.ru",
]);
const PROTECTED_PATH_PREFIXES = [
  "/my-pets",
  "/profile",
  "/admin/sql",
  "/admin/moderation",
  "/admin/video",
  "/admin/gift-slots",
  "/admin/tiktok",
];

function normalizeHost(value: string | null) {
  const firstHost = value?.split(",")[0]?.trim();
  if (!firstHost) {
    return "";
  }
  return firstHost.replace(/^"|"$/g, "").split(":")[0]?.toLowerCase() || "";
}

function getForwardedHost(request: NextRequest) {
  const forwarded = request.headers.get("forwarded");
  const match = forwarded?.match(/(?:^|[;,]\s*)host=("[^"]+"|[^;,]+)/i);
  return match?.[1] ?? null;
}

function shouldRedirectToCanonical(request: NextRequest) {
  const hostCandidates = [
    request.nextUrl.hostname,
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
    request.headers.get("x-original-host"),
    request.headers.get("x-host"),
    getForwardedHost(request),
  ].map(normalizeHost);

  return hostCandidates.some((hostname) => REDIRECT_HOSTS.has(hostname));
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function middleware(request: NextRequest) {
  if (shouldRedirectToCanonical(request)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = "https:";
    redirectUrl.hostname = CANONICAL_HOST;
    redirectUrl.port = "";
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.has(AUTH_COOKIE)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/auth";
  redirectUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest).*)",
  ],
};
